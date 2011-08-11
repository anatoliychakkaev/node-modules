var fs   = require('fs');
var path = require('path');
var Browser = require('./browser');

function Spider (host, secure) {
    if (!host) {
        return;
    }

    this.ddosPreventTimeout = 1000;

    this.host = host;
    this.spider = new Browser(host, secure);

    // timeout for killing proxy connection
    this.spider.connectionTimeout = process.env.TIMEOUT || 10000;
    this.setDataDir(host);
};

Spider.prototype = new process.EventEmitter();

Spider.prototype.setDataDir = function (name) {
    var base = process.cwd() + '/data/';
    this.dataDir = base + name.replace(/\//g, '-');

    // create basedir
    if (!path.existsSync(base)) {
        fs.mkdirSync(base, 0755);
    }

    // create host dir
    if (!path.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, 0755);
    }
};

Spider.prototype.cleanupDataDir = function () {
    fs.readdirSync(this.dataDir).forEach(function (file) {
        if (file.match(/\.json$/)) {
            fs.unlinkSync(path.join(this.dataDir, file));
        }
    }.bind(this));
};

/**
 * Store string or obj to datadir/page.json file
 * @param page String - name of page
 * @param data String or Object - data to store
 */
Spider.prototype.store = function (page, data) {
    if (typeof data !== 'string') {
        str = JSON.stringify(data);
        data = str;
    }
    fs.writeFileSync(this.dataDir + '/' + page + '.json', data || '');
};

Spider.prototype.onComplete = function () {};

Spider.prototype.complete = function () {
    this.onComplete();
};

module.exports = Spider;
