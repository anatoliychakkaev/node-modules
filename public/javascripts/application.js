function dataLoaded(data) {
    $(function () {
        var html = '';
        var side = '<ul class="index">';
        var curDepth = 0;
        var curNode = data.data[0].name[1];
        $(data.data).each(function () {
            if (this.name[0] === 'Modules') {
                this.name.shift();
            }
            if (curNode !== this.name[curDepth - 1] && curDepth > 0) {
                side += '</ul></li>';
                curDepth -= 1;
            }
            if (curDepth < this.name.length - 1) {
                while (curDepth < this.name.length - 1) {
                    side += '<li>' + this.name[curDepth] + ' <ul>';
                    curDepth += 1;
                }
            } else if (curDepth > this.name.length - 1) {
                while (curDepth > this.name.length - 1) {
                    side += '</ul></li>';
                    curDepth -= 1;
                }
            }
            curNode = this.name[curDepth - 1];
            var id = this.name.join('-');
            side += '<li><a href="#' + id + '">' + this.name[this.name.length - 1] + '</a></li>';
            html += '<a name="' + id + '"></a><h1>' + this.name.join(' > ') + '</h1>';
            html += '<ul>';
            $(this.stats).each(function (index) {
                html += '<li class="project ' + (index % 2 ? 'even' : 'odd') + '" data-id="' + this.project.id + '">' +
                '<div class="description">' +
                    '<div class="project-name">' + this.project.url.replace('https://github.com/', '').replace('/', ' / ') + '</div>' +
                    '<div class="hint">' + this.project.description + '</div>' +
                '</div>' +
                '<div class="digit-block watchers">' +
                    '<div class="number">' + f(this.watchers) + '</div>' +
                    '<div class="hint">watchers</div> ' +
                '</div>' +
                '<div class="digit-block forks">' +
                    '<div class="number">' + f(this.forks) + '</div>' +
                    '<div class="hint">forks</div>' +
                '</div>' +
                '</li>';
            });
            html += '</ul>';
        });
        $('#modules').html(html);
        $('#sidebar').html(side + '</ul>');
    });
}

function f(x) {
    return x.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

var scrollTop;
var projectListDisplayed = true;

function projectDetails(prj) {
    $modules = $('#modules');
    $project = $('#project');
    projectListDisplayed = false;

    var width = $modules.width();
    $modules.css('width', width);
    $modules.animate({
        'margin-left': -$modules.width()
    }, function done() {
        scrollTop = document.body.scrollTop;
        document.body.scrollTop = 0;
        $('body').css('overflow', 'hidden');
        $project.show();
        var id = $(prj).parents('.project').attr('data-id');
        $project.find('.project-name').text(id.replace('/', ' / '));
        $project.find('.wikistyle').html('');
        $.getJSON('/project/info?id=' + id, function (data) {
            var series = [extract(data.stats.f), extract(data.stats.w)];
            $.plot($project.find('.project-stats'), series, {});
            // $project.find('.project-stats').text(JSON.stringify(data.stats));

            $project.find('.wikistyle').html(data.html);
        });
    });
}

function extract(data) {
    var points = [];
    var prev;
    for (var i in data) {
        if (!prev) prev = data[i];
        points.push([i, data[i] - prev]);
        prev = data[i];
    }
    return points;
}

function projectList() {
    projectListDisplayed = true;
    $modules = $('#modules');
    $project = $('#project');
    $('body').css('overflow', 'auto');
    document.body.scrollTop = scrollTop;
    $('#modules').animate({
        'margin-left': $('#sidebar').width()
    }, function () {
        $modules.css('width', 'auto');
        $project.hide();
        $modules.show();
    });
}

$(function () {

    $('li.project .project-name').live('click', function (e) {
        if (e.target.nodeName === 'A') {
            return true;
        }
        projectDetails(this);
        // setTimeout(projectList, 1600);
    });

    $('#sidebar ul.index li a').live('click', function () {
        if (!projectListDisplayed) {
            projectList();
        }
        return true;
    });

    setTimeout(function () {
        projectDetails($('li.project .project-name')[0]);
    }, 500);

});
