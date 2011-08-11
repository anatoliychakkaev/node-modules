var Spider = require('./spider');
var Browser = require('./browser');

var gh = new Spider('github.com', true);
// gh.spider.enableCache(gh.dataDir + '/cache');

var api = new Browser('api.github.com', true);
api.enableCache(gh.dataDir + '/cache');

var frameworks = [];
var groups = [];
var result = [];
var total = 0;

var parentsSelector = 'h1,h2,h3,h4,h5,h6,a';

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

gh.spider.get('/joyent/node/wiki/Modules', function ($) {
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
                        total += 1;
                    }
                });
                if (links.length) {
                    groups.push({name: text, links: links, stats: []});
                }
            }
        }
    });
    loadGroups();
});

function loadGroups() {
    var group = groups.shift();
    if (group) {
        loadProjects(group, loadGroups);

        api.onerror = function () {
            loadProjects(group, loadGroups);
            return false;
        }

    } else {
        var now = new Date;
        gh.store(now.getFullYear() + '-' + td(now.getMonth() + 1) + '-' + td(now.getDate()), result);
    }
}

function td(n) {
    if (n < 10) return '0' + n;
    return n;
}

function loadProjects(group, done) {
    console.log('Loading projects for group "%s": %d left',
        group.name.join(' > '), group.links.length);
    var project = group.links.shift();
    if (!project) {
        store(group);
        done();
        return;
    }
    var path = '/repos/' + project[0];
    console.log('GET', path);
    api.getJSON(path, function (data) {
        group.stats.push(new RepositoryInfo(data, project[0], project[1]));
        loadProjects(group, done);
    });
}

function store(group) {
    group.stats = group.stats.sort(function (a, b) { return b.forks - a.forks || b.watchers - a.watchers;});
    result.push(group);
}

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

var stats = [];

function grabStats() {
    var path = frameworks.shift();
    if (!path) {
        stats = stats.sort(function (a, b) { return b.forks - a.forks || b.watchers - a.watchers;});
        var now = new Date;
        gh.store('frameworks-' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(), stats);
        stats.forEach(function (stat, index) {
            console.log('%d. %s (%d watchers, %d forks) %s',
                index + 1,
                stat.project.name,
                stat.watchers,
                stat.forks,
                stat.project.url
            );
        });
        return;
    }
    path = path.split('/');
    api.getJSON('/repos/' + path[0] + '/' + path[1], function (data) {
        stats.push(new RepositoryInfo(data));
        grabStats();
    });
    return;
}

