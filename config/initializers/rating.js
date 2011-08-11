var fs = require('fs');

var dataDir = app.root + '/data/github.com';
var files = [];
var last, prev, yesterday, today;
fs.readdirSync(dataDir).forEach(function (file) {
    var m = file.match(/(\d+)-(\d+)-(\d+)\.json$/);
    if (m) {
        prev = last;
        last = file;
        files.push(file);
    }
});

if (prev !== last) {
    yesterday = load(prev);
}
today = load(last);

function load(file) {
    console.log('loading', file);
    var m = file.match(/(\d+)-(\d+)-(\d+)\.json$/);
    return {
        y: parseInt(m[1], 10),
        m: parseInt(m[2], 10),
        d: parseInt(m[3], 10),
        data: JSON.parse(fs.readFileSync(dataDir + '/' + file))
    };
}

var yesterdayIndex = buildIndex(yesterday || today);

addStats(today, yesterdayIndex, 'yesterday');

function buildIndex(batch) {
    var index = {};
    batch.data.forEach(function (group) {
        group.stats.forEach(function (e) {
            if (!e.project.id) e.project.id = e.project.url;
            index[e.project.id] = [e.watchers, e.forks];
        });
    });
    return index;
}

function addStats(batch, index, name) {
    batch.data.forEach(function (group) {
        group.stats.forEach(function (e) {
            var entry = index[e.project.id || e.project.url];
            if (entry) {
                e[name] = {
                    watchers: entry[0],
                    forks: entry[1]
                };
            }
        });
    });
}

fs.writeFileSync(app.root + '/public/modules.js', 'dataLoaded(' + JSON.stringify(today) + ');');

