/**
@example_title Table
@example_order 42
@example_html
    <style>body, html { margin: 0; padding: 0; overflow:hidden; };</style>
    <script src="/src/uki.cjs"></script>
    <script src="searchable.js"></script>
    <script src="table.js"></script>
*/


// custom formatter for duration column
function formatTime (t) {
    return t;
}

// formatter for highlighted strings
var hlt = '';
function formatHlted (t) {
    return t;
    return hlt ? (t || '').replace(hlt, '<strong>' + hlt + '</strong>') : t;
}

uki({
    view: 'HSplitPane',
    rect: '1000 1000',
    anchors: 'left top right bottom',
    handleWidth: 1,
    handlePosition: 199,
    leftMin: 150,
    rightMin: 400,
    leftPane: {
        background: '#D0D7E2',
        childViews: [ // search panel
            {
                view: 'TextField',
                rect: '5 18 189 22',
                anchors: 'left top right',
                placeholder: 'search'
            }
        ]
    },
    rightChildViews: [ // table with resizable columns
        {
            view: 'Table',
            rect: '0 0 800 1000',
            minSize: '0 200',
            anchors: 'left top right bottom',
            columns: [
                {
                    view: 'table.CustomColumn',
                    label: 'Name',
                    resizable: true,
                    minWidth: 100,
                    width: 250,
                    formatter: formatHlted
                },
                {
                    view: 'table.NumberColumn',
                    label: 'Forks',
                    width: 80,
                },
                {
                    view: 'table.NumberColumn',
                    label: 'Watchers',
                    width: 80,
                    sort: 'ASC'
                },
                {
                    view: 'table.NumberColumn',
                    label: 'Last update',
                    resizable: true,
                    width: 180,
                    formatter: formatTime
                }
            ],
            multiselect: true,
            style: {
                fontSize: '14px',
                lineHeight: '21px',
                height: '20px'
            }
        },
        {
            view: 'Label',
            rect: '200 200 400 20',
            anchors: 'top',
            textAlign: 'center',
            text: 'Loading...',
            id: 'loading'
        }
    ]
}).attachTo( window, '1000 1000' );

// searchable model
window.DummyModel = uki.newClass(Searchable, new function() {
    this.init = function(data) {
        this.items = data;
        uki.each(this.items, function(i, row) {
            row.searchIndex = row[0].toLowerCase();
        })
    };
    
    this.matchRow = function(row, iterator) {
        return row.searchIndex.indexOf(iterator.query) > -1;
    };
});

// dinamicly load library json
window.onLibraryLoad = function(data) {
    uki('#loading').visible(false);
    var model = new DummyModel(data),
        lastQuery = '',
        table = uki('Table');
        
    model.bind('search.foundInChunk', function(chunk) {
        table.data(table.data().concat(chunk)).layout();
    });
    
    table.find('Header').bind('columnClick', function(e) {
        var header = this;
            
        if (e.column.sort() == 'ASC') e.column.sort('DESC');
        else e.column.sort('ASC');
        
        header.redrawColumn(e.columnIndex);
        uki.each(header.columns(), function(i, col) {
            if (col != e.column && col.sort()) {
                col.sort('');
                header.redrawColumn(i);
            }
        });
        model.items = e.column.sortData(model.items);
        table.data(model.items);
    })
        
    table.data(model.items);
    
    uki('TextField').bind('keyup click', function() {
        if (this.value().toLowerCase() == lastQuery) return;
        lastQuery = this.value().toLowerCase();
        if (lastQuery.match(/\S/)) {
            hlt = lastQuery;
            table.data([]);
            model.search(lastQuery);
        } else {
            hlt = '';
            table.data(model.items);
        }
    });
    document.body.className += '';
};

var script = document.createElement('script'),
    head = document.getElementsByTagName('head')[0];
script.src = '/javascripts/library.js';
head.insertBefore(script, head.firstChild);
