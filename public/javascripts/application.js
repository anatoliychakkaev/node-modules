// when data loaded
function dataLoaded(data) {
    // and document is ready
    $(function () {
        renderList(data);
        var index = [];
        $('#modules > ul').each(function () {
            index.push([this.offsetTop - 52, this.offsetTop + this.offsetHeight, $(this).prev('h1')]);
        });
        window.modulesIndex = index;
    });
}

function renderList(data) {
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
        var id = this.name.join('-').replace(/[^a-z]+/gi, '-').toLowerCase();
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
}

// state variables

var scrollTop;
var projectListDisplayed = true;
var floatHeader;

// view methods

function viewProjectDetails(id) {
    $modules = $('#modules');
    $project = $('#project');
    projectListDisplayed = false;
    if (floatHeader) {
        floatHeader.hide();
    }

    var width = $modules.width();
    $modules.css('width', width);
    $modules.animate({
        'margin-left': -$modules.width()
    },
    function animationDone() {
        scrollTop = document.body.scrollTop;
        document.body.scrollTop = 0;
        $('body').css('overflow', 'hidden');
        $project.show();
        $project.find('.project-name').html(id.replace('/', ' / ') + '<a href="http://twitter.com/share" class="twitter-share-button" data-count="horizontal" data-via="1602">Tweet</a><script type="text/javascript" src="http://platform.twitter.com/widgets.js"></script>');
        $project.find('.wikistyle').html('');
        $.getJSON('/project/info?id=' + id, function (data) {
            var series = [extract(data.stats.w)];
            $.plot($project.find('.project-stats'), series, {
                series: {
                    lines: { show: true, fill: true },
                    points: {
                        show: true,
                        fill: true
                    },
                    bars: {
                        show: false
                    }
                },
                xaxis: {
                    tickSize: 1
                },
                yaxis: {
                    // tickSize: 1
                }
            });
            $project.find('.wikistyle').html(data.html);
        });
    });
}

function viewProjectList() {
    projectListDisplayed = true;
    $modules = $('#modules');
    $project = $('#project');
    $('body').css('overflow', 'auto');
    document.body.scrollTop = scrollTop;
    $('#modules').animate({
        'margin-left': $('#sidebar').width()
    },
    function animationDone() {
        $modules.css('width', 'auto');
        $project.hide();
        $modules.show();
        if (floatHeader) {
            floatHeader.show();
        }
    });
}

// helper methods

function extract(data) {
    var points = [];
    var prev;
    for (var i in data) {
        if (!prev) prev = data[i];
        points.push([i, data[i]]);
        prev = data[i];
    }
    return points;
}

// format number (put commas as thousands delimitier)
function f(x) {
    return x.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

$(function () {

    $('li.project .project-name').live('click', function (e) {
        if (e.target.nodeName === 'A') {
            return true;
        }
        var id = $(this).parents('.project').attr('data-id');
        if (history.pushState) {
            history.pushState(id, $(this).text(), '/#!' + id);
        }
        viewProjectDetails(id);
    });

    $('#sidebar ul.index li a').live('click', function () {
        listScrolled();
        if (!projectListDisplayed) {
            viewProjectList();
        }
        return true;
    });

    if (location.hash && location.hash.match(/^#!/)) {
        setTimeout(function () {
            var id = location.hash.replace('#!', '');
            viewProjectDetails(id);
        }, 500);
    }

    if (history.pushState) {
        history.pushState(null, null, '/' + location.hash);
    }

    window.addEventListener("popstate", function (e) {
        if (!(e.state && e.state.search('/')) && !projectListDisplayed) {
            viewProjectList();
        }
        if (e.state && e.state.search('/') && projectListDisplayed) {
            viewProjectDetails(e.state);
        }
    }, false);

    window.addEventListener('scroll', listScrolled, false);

    var headerHeight = 52;
    function listScrolled() {
        var st = document.body.scrollTop || document.documentElement.scrollTop;
        var $header, $nextHeader;
        for (var i = 0, len = modulesIndex.length; i < len; i += 1) {
            if (modulesIndex[i][0] < st && st <= modulesIndex[i][1]) {
                bottomBound = modulesIndex[i][1];
                $header = modulesIndex[i][2];
                break;
            }
        }
        if (!$header) {
            return;
        }
        if (floatHeader !== $header) {
            if (floatHeader) {
                floatHeader.css({
                    'position': 'relative',
                    'opacity': '1',
                    'z-index': 3,
                    'left': 0
                });
                floatHeader.next('ul').css('margin-top', 0);
            }
            $header.css({
                'position': 'fixed',
                'opacity': .7,
                'z-index': 2,
                'left': 290
            });
            $header.next('ul').css('margin-top', headerHeight);
            floatHeader = $header;
        }
        // if (bottomBound - st < headerHeight) {
            // $header.css('top', -headerHeight + bottomBound - st);
        // }
    }

});
