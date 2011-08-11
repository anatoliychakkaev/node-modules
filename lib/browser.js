var USER_AGENT = 'Mozilla/5.0 (X11; U; Linux i686; en-US) AppleWebKit/534.7 (KHTML, like Gecko) Chrome/12.0.517.44 Safari/534.7',
    jsdom  = require('jsdom'),
    path   = require('path'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    jquery = require('./jquery');

function Browser (host, secure) {
    this.host = host;
    this.secure = secure;
    this.readCookieCache();
    this.cache = false;
}

Browser.initByUrl = function (url) {
    var url = require('url').parse(url);
    var b = new Browser(url.host);
    b.secure = url.protocol === 'http:';
    b.url = url.pathname;
    if (url.search) {
        b.url += url.search;
    }
    return b;
};

Browser.prototype.readCookieCache = function () {
    try {
        this.cookie = JSON.parse(fs.readFileSync(process.cwd() + '/cookie.json').toString())[this.host] || {};
    } catch (e) {
        this.cookie = {};
    }
};

Browser.prototype.writeCookieCache = function () {
    var cookie;
    try {
        cookie = JSON.parse(fs.readFileSync(process.cwd() + '/cookie.json').toString());
    } catch(e) {
        cookie = {};
    }
    console.log(this.cookie);
    cookie[this.host] = this.cookie;
    fs.writeFileSync(process.cwd() + '/cookie.json', JSON.stringify(cookie));
};

Browser.prototype.GET = Browser.prototype.get = function (path, callback, host) {
    this.request('GET', path, null, callback, host);
};

Browser.prototype.getJSON = function (path, callback) {
    this.request('GET', path, null, done);

    var that = this;
    function done () {
        if (!that.response.body) {
            console.log('Blank response body. Retrying...');
            retry();
            return;
        }
        try {
            var data = JSON.parse(that.response.body);
        } catch (e) {
            console.log('Invalid JSON: %s. Retrying', e.message);
            retry();
            return;
        }
        console.log('Valid JSON formatted object');
        callback(data);
    }

    function retry () {
        that.getJSON(path, callback);
    }
};

Browser.prototype.getXML = function (path, callback) {
    this.acceptXML = true;
    this.request('GET', path, null, done);

    var that = this;
    function done () {
        that.acceptXML = false;
        console.log('XML parser started');
        var parser = new xml2js.Parser();
        if (!that.response.body) {
            console.log('Blank response body. Retrying...');
            retry();
            return;
        }
        parser.addListener('end', function(result) {
            console.log('Valid XML formatted object');
            callback(result);
        });
        parser.parseString(that.response.body);
    }

    function retry () {
        that.getXML(path, callback);
    }
};

Browser.prototype.POST = Browser.prototype.post = function (path, data, callback) {
    this.request('POST', path, data, callback);
};

Browser.prototype.request = function (method, path, data, callback, host) {
    var that = this;

    if (this.cache && this.applyCache(path, callback)) {
        return;
    }
    // var client;

    var headers = {host: host || this.host};
    headers['User-Agent'] = USER_AGENT;
    if (data) {
        headers['Content-Length'] = data.length;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    var cookies = [];
    Object.keys(this.cookie).forEach(function (key) {
        cookies.push(key + '=' + this.cookie[key]);
    }.bind(this))
    headers.Cookie = cookies.join('; ');
    this.url = path;
    try {
        var request = (this.secure ? https : http).request({
            host: host || this.host,
            port: (this.secure ? 443 : 80),
            method: method,
            path: path,
            headers: headers
        }, onResponse.bind(this));
    } catch (e) {
        retry.call(this, false, e);
        return;
    }

    var timeout = setTimeout(function () {
        if (!that.disregardTimeout) {
            console.log('Request killed by timeout');
            request.abort();
            request.abortedByMe = true;
            retry();
        }
    }, this.connectionTimeout);

    function onResponse (response) {
        console.log('got response ' + response.statusCode);
        this.response = response;
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(function (cookie) {
                var tokens = cookie.split(';')[0].split('=');
                this.cookie[tokens[0]] = tokens[1];
            }.bind(this));
            this.writeCookieCache();
        }
        response.body = '';
        response.setEncoding('utf8');

        var lastChunkTimestamp;
        var lct = setInterval(function () {
            if (lastChunkTimestamp && Date.now() - lastChunkTimestamp > that.lastChunkTimeout) {
                // console.log('end');
                // that.emit('end');
                console.log(response.body.length);
            } else if (that.lastChunkTimeout) {
                console.log('Still alive');
                console.log(response.body.length);
            }
        }, 3000);
        response.addListener('data', function (chunk) {
            response.body += chunk;
            lastChunkTimestamp = Date.now();
        });
        response.addListener('end', function () {
            clearTimeout(timeout);
            clearInterval(lct);
            console.log('Done');
            if (response.statusCode === 200 || response.statusCode === 302 && that.noRedir) {
                this.response = response;
                if (!this.acceptXML) {
                    try {
                        this.window = jsdom.jsdom(normalize(response.body), null, {
                            features: {
                                FetchExternalResources: false,
                                ProcessExternalResources: false
                            }
                        }).createWindow();
                        this.$ = jquery.create(this.window);
                    } catch (e) {
                        this.window = false;
                        this.$ = false;
                    }
                }
                this.cacheResponse(path, response);
                done();
            } else if (response.statusCode === 302 && !that.noRedir) {
                var location = response.headers.location;
                that.secure = location.protocol === 'https:';
                that[method === 'GET' || method === 'POST' ? 'GET' : 'getJSON'](location.pathname + location.search, done, location.host);
            } else {
                retry.call(this, response.statusCode);
            }
        }.bind(this));
    }
    if (data) {
        request.write(data);
        console.log(data);
    }
    request.on('error', function (e) {
        clearTimeout(timeout);
        retry.call(that, false, e);
    });
    request.end();

    function retry(statusCode, err) {
        if (statusCode) {
            console.log('Response returned statusCode ' + statusCode);
        }
        if (err) {
            console.log(err.message || err);
        }
        if (that.onerror && that.onerror() || !that.onerror) {
            console.log('retrying...');
            that[method](path, done);
        }
    }

    function done () {
        callback(that.$);
        callback = function () {};
    }
};

Browser.prototype.enableCache = function (basePath) {
    this.cache = basePath;
    if (!path.existsSync(this.cache)) {
        fs.mkdirSync(this.cache, 0755);
    }
};

Browser.prototype.cached = function (apath) {
    apath = escapePath(apath);
    return path.existsSync(this.cache + '/' + apath);
};

Browser.prototype.applyCache = function (apath, callback) {
    apath = escapePath(apath);
    if (this.cached(apath)) {
        console.log('Using cache');
        var body = fs.readFileSync(this.cache + '/' + apath).toString();
        this.response = {body: body};
        if (!this.acceptXML) {
            try {
                this.window = jsdom.jsdom(normalize(body), null, {
                    features: {
                        FetchExternalResources: false,
                        ProcessExternalResources: false
                    }
                }).createWindow();
                this.$ = jquery.create(this.window);
            } catch (e) {
                this.window = false;
                this.$ = false;
            }
        }
        process.nextTick(function () {
            callback(this.$);
        }.bind(this));
        return true;
    } else {
        return false;
    }
};

Browser.prototype.cacheResponse = function (apath, res) {
    if (this.cache) {
        apath = escapePath(apath);
        fs.writeFileSync(this.cache + '/' + apath, res.body);
    }
};

Browser.prototype.removeCache = function (apath) {
    if (this.cache) {
        apath = escapePath(apath);
        var fname = this.cache + '/' + apath;
        if (path.existsSync(fname)) {
            fs.unlinkSync(fname);
        }
    }
};

function escapePath(path) {
    return path.replace(/[^a-z0-9]+/gi, '-');
}

function normalize(html) {
    if (!~html.indexOf('<body')) html = '<body>' + html + '</body>';
    if (!~html.indexOf('<html')) html = '<html>' + html + '</html>';
    html = html.split(/<\/html>/)[0] + '</html>';
    return html;
}

module.exports = Browser;
