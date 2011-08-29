var Browser = require(app.root + '/lib/browser');

load('application');

action("info", function () {
    var bro = new Browser('github.com', true);
    bro.enableCache(app.root + '/data/github.com/cache')
    var id = req.param('id');
    bro.get('/' + id, function ($) {
        send({
            id: id,
            html: $('#readme .wikistyle').html(),
            stats: app.timeline[id]
        });
        // console.log('stats: ', app.timeline[id]);
    });
});
