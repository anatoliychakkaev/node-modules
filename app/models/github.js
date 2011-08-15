var fs = require('fs');
var path = require('path');
var Spider = require(app.root + '/lib/spider');
var Browser = require(app.root + '/lib/browser');

function Github() {

    this.gh = new Spider('github.com', true);
    this.api = new Browser('api.github.com', true);

    // autoenable cache in development mode?
    // this.gh.spider.enableCache(gh.dataDir + '/cache');
    // this.api.enableCache(gh.dataDir + '/cache');

    this.groups = [];
    this.result = [];
    this.total = 0;

}

Github.prototype.indexModules = function () {
    var self = this;
    var parentsSelector = 'h1,h2,h3,h4,h5,h6,a';

    this.gh.spider.get('/joyent/node/wiki/Modules', function ($) {
        $('.wrap ul').each(function () {
            var $header = $(this).prev(parentsSelector);
            var $list = $(this);
            var searchIndex = {};
            if ($header.is(parentsSelector) && $list.parents('ul').size() < 2) {
                var text = [];
                while (true) {
                    text.unshift($header.text().replace(/^\s+|\s+$/g, ''));
                    var $parents = $header.parents('ul');
                    if ($parents.size() > 0) {
                        $header = $($parents[$parents.size() - 1]).prevAll(parentsSelectorFor($header));
                    } else {
                        $header = $header.prevAll(parentsSelectorFor($header));
                    }
                    $header = $($header[0]);
                    if (!$header.is(parentsSelector)) {
                        break;
                    }
                }
                if ($list.find('> li > ul').size() === 0 || $list.parents('ul').size() === 1) {
                    // console.log('%s: %d modules', text.join(' > '), $(this).find('> li > a').size());
                    var links = [];
                    $list.find('> li > a').each(function () {
                        var descr = $(this.parentNode).html();
                        if (searchIndex[descr]) {
                            return;
                        }
                        if (text.indexOf('Compression') !== -1) {
                            console.log(this.href);
                        }
                        if (this.href.match(/https:\/\/github.com\//i)) {
                            searchIndex[descr] = this.href;
                            var project = this.href.replace('https://github.com/', '').split('/');
                            links.push([project[0] + '/' + project[1], descr]);
                            self.total += 1;
                        }
                    });
                    if (links.length) {
                        self.groups.push({name: text, links: links, stats: []});
                    }
                }
            }
        });
        self.loadGroups();
    });

};

function parentsSelectorFor($header) {
    var tagName = $header[0].tagName.toLowerCase();
    switch (tagName) {
        case 'h1':
        return '';
        case 'h2':
        return 'h1';
        case 'h3':
        return 'h1,h2';
        case 'h4':
        return 'h1,h2,h3';
        case 'h5':
        return 'h1,h2,h3,h4';
        case 'h6':
        return 'h1,h2,h3,h4,h5';
    }
}

Github.prototype.loadGroups = function loadGroups() {
    var group = this.groups.shift();
    if (group) {
        this.loadProjects(group, loadGroups.bind(this));

        this.api.onerror = function () {
            this.loadProjects(group, loadGroups.bind(this));
            return false;
        }.bind(this);

    } else {
        var now = new Date;
        this.gh.store(Github.getTodayFilename(), this.result);
        Github.updateFrontend();
    }
}

Github.prototype.loadProjects = function loadProjects(group, done) {
    console.log('Loading projects for group "%s": %d left',
        group.name.join(' > '), group.links.length);
    var project = group.links.shift();
    if (!project) {
        this.store(group);
        done();
        return;
    }
    var path = '/repos/' + project[0];
    console.log('GET', path);
    this.api.getJSON(path, function (data) {
        group.stats.push(new RepositoryInfo(data, project[0], project[1]));
        loadProjects.call(this, group, done);
    }.bind(this));
};

Github.prototype.store = function store(group) {
    // sort stats by: forks DESC, watchers DESC
    group.stats = group.stats.sort(function (a, b) { return b.forks - a.forks || b.watchers - a.watchers;});
    // add group to resulting array
    this.result.push(group);
};

Github.getTodayFilename = function () {
    var now = new Date;
    return now.getFullYear() + '-' + td(now.getMonth() + 1) + '-' + td(now.getDate());

    function td(n) {
        if (n < 10) return '0' + n;
        return n;
    }

};

Github.updateFrontend = function () {

    var dataDir = app.root + '/data/github.com';
    var files = [];
    var yesterday, today;

    // read datadir
    fs.readdirSync(dataDir).forEach(function (file) {
        var m = file.match(/(\d+)-(\d+)-(\d+)\.json$/);
        if (m) {
            files.push(file);
        }
    });

    today = load(files.pop());

    // read timeline
    var timeline;
    if (path.existsSync(dataDir + '/timeline.json')) {
        timeline = JSON.parse(fs.readFileSync(dataDir + '/timeline.json'));
    } else {
        timeline = {};
        files.forEach(function (file) {
            var batch = load(file);
            addToIndex(batch, timeline);
        });
    }

    addToIndex(today, timeline);

    app.timeline = timeline;

    function load(file) {
        console.log('loading', file);
        var m = file.match(/(\d+)-(\d+)-(\d+)\.json$/);
        var batch = {
            y: parseInt(m[1], 10),
            m: parseInt(m[2], 10),
            d: parseInt(m[3], 10),
            data: JSON.parse(fs.readFileSync(dataDir + '/' + file))
        };
        batch.delta = Math.round((new Date(batch.y, batch.m - 1, batch.d, 12) - new Date(2011, 7, 2)) / 86400000);
        return batch;
    }

    function addToIndex(batch, index) {
        batch.data.forEach(function (group) {
            group.stats.forEach(function (e) {
                if (!e.project.id) e.project.id = e.project.url.replace('https://github.com/', '');
                if (!index[e.project.id]) {
                    index[e.project.id] = {w: {}, f: {}};
                }
                index[e.project.id].w[batch.delta] = e.watchers;
                index[e.project.id].f[batch.delta] = e.forks;
            });
        });
    }

    fs.writeFileSync(app.root + '/public/modules.js', 'dataLoaded(' + JSON.stringify(today) + ');');
    fs.writeFileSync(dataDir + '/timeline.json', JSON.stringify(timeline));
};

Github.runDailyUpdate = function () {
    var today = Github.getTodayFilename();
    if (!path.existsSync(app.root + '/data/github.com/' + today + '.json')) {
        console.log(app.root + '/data/github.com/' + today + '.json');
        var github = new Github;
        github.indexModules();
    }
    setInterval(function () {
        Github.runDailyUpdate();
    }, 3 * 60 * 60 * 1000);
};

function RepositoryInfo(data, id, description) {
    this.project = {
        name: data.name,
        description: description,
        id: id,
        url: data.html_url,
        git: data.git_url
    };
    this.watchers = data.watchers;
    this.forks    = data.forks;
    this.issues   = data.open_issues;
    this.pushDate = data.pushed_at;
}

export('Github', Github);
