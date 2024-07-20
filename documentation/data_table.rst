==================================
DataTable Partial Documentation
==================================

Documentation for depmap.partials.data_table.py

The class is called ``DataTable``. Anything in snake case (e.g. variable names) should use ``data_table``, consistent with capitalization.

To create a data_table, instantiate_ one in a factory and follow the two `usage`_ instructions, as described below. For any additional javascript callbacks after table creation, see the `dataLoadCallback`_ section.

.. _instantiate:

Instantiation
=========================
To use the data_table partial, create a factory that instantiates a ``DataTable``. Two main classes are involved in this: ``TableDisplay``, and ``DataTable``.

Factory
-------------------------
A given configuration of a DataTable object needs to be available in two places: the data structure for the jinja template and the ajax endpoint. To avoid repetition, define how to create the DataTable in a function in ``depmap/partials/data_table/factories.py`` decorated by ``@_data_table_factory`` ::

    @_data_table_factory("mutation")
    def _get_mutation_table(gene_id):
        query = Mutation.query.filter_by(gene_id=gene_id)
        cols = ["cell_line_name", "ncbi_build", "chromosome", "start_position"]
        factory_params = {'type': 'mutation', 'gene_id': gene_id}
        table_display = TableDisplay(cols, factory_params)
        name = 'mutation'
        filename = 'mutations'
        data_table = DataTable(query, table_display, name, filename)
        return data_table


TableDisplay
-------------------------
::

    class TableDisplay(DataFrameDisplay):
        def __init__(self, cols, factory_params, renames=None, format=None, replace_underscores=True, make_title_case=True,
                 renders=None, invisible_cols=None, sort_col=None, additional_react_table_props={}):

A ``TableDisplay`` specifies how the table should be displayed. At minimum, this involves what columns should be shown, and their order. A full description of ``TableDisplay`` params can be found in the `TableDisplay Options`_ section below.


DataTable
-------------------------
::

    class DataTable():
        def __init__(self, data_or_query, table_display, name, filename):

A ``DataTable`` takes in a SQLAlchemy query or instance of ``DataTableData``, a ``TableDisplay``, and some string identifier ``name`` to distinguish it from other ``DataTable`` s on the same page.

``filename`` is the name of a csv downloaded from the table, and can be either a string, or a dictionary with keys ``'function'`` and ``'params'``, e.g. ::

    {
        'function': lambda gene_id: Gene.query.get(gene_id).label,
        'params': {'gene_id': gene_id}
    }

``'function'`` will be called with ``'params'`` when a download is requested (i.e. will not be evaluated when the table is displayed)

DataTableData
^^^^^^^^^^^^^^^^^^^^^^^^^
``DataTableData`` is used when the desired data cannot be easily expressed as a SQLAlchemy query. ::

    class DataTableData():
        def __init__(self, get_column_types, get_data):

``get_column_types`` is a function that returns a dict of column_name: column_type, where column_type is SQLAlchemy column type

``get_data`` is a function that returns a pandas dataframe, with the column names specified from ``get_column_types``.

Usage
=========================
Given the above factory, two things are needed two render the DataTable

1. Inject the result of calling ``get_data_table_for_view`` into the jinja template ::

    mutation_table = get_data_table_for_view('mutation', gene_id=gene_id)
    return render_template(
        'genes/index.html',
        mutation_table=mutation_table
    )

2. Use the jinja2 macro ``partials.wide_data_table`` taking in the injected ``mutation_table`` to create the component in the html template ::

    <div>
        <h2>Mutation Table</h2>
        {{ partials.wide_data_table(mutation_table) }}
    </div>

The factory is automatically wired to endpoints in ``depmap/partials/views.py`` for the table contents to be obtained asynchronously, and to download the table. There is no need to write endpoints.

.. _this:

TableDisplay Options
=========================

The following display options are available:

``cols`` and ``factory_params`` are the only required params.

``renames``, ``replace_underscores`` and ``make_title_case`` deal with how column names should be displayed.

``format`` is used to make cells e.g. 3 decimal places.

``renders`` is used to create html elements, (e.g. for links and CSS) within cells.

``add_class`` is used to directly apply a classes to the ``<td>`` element of cells.

``invisible_cols`` is used to hide columns from the table display and show/hide column dropdown.

``sort_col`` is a string of the column name to sort on, or a tuple of (column name, sort direction)

``additional_react_table_props`` is used to directly extend the ReactTable props

cols
-------------------------
A list of database column names, used to specify which columns to show and the order in which to show them. ::

    cols = ["cell_line_name", "ncbi_build", "chromosome", "start_position"]

factory_params
-------------------------
Dict of params needed to define the factory, i.e. the factory type and any parameters passed into the function. For instance, given a factory ::

    @_data_table_factory("dependency_biomarker_correlation")
    def _get_dependency_biomarker_correlation_table(entity_id, entity_label, category):

The ``factory_params`` dict should be ::

    {
        'type': 'dependency_biomarker_correlation',
        'entity_id': entity_id,
        'entity_label': entity_label,
        'category': category
    }

This is used for the endpoints to get table contents and download the table.

renames
-------------------------
A dict where keys are database column names, and values are how the column name should be displayed in the rendered table.

If replace_underscores or make_title_case are set they will only be applied on columns that do not have a specified rename. ::

    renames = {'ncbi_build' : 'NCBI Build'}

format
-------------------------
A dict where keys are database column names, and values are a string format to apply to every value in the specified column. E.g. to show 10 decimal places: ::

    format = {'ncbi_build': '{0:.10f}'}

replace_underscores and make_title_case
-----------------------------------------
Booleans, which respectively will replaces underscores with spaces and capitalize the first letter of each word, for every column name that does not have a specified rename. ::

    replace_underscores = True
    make_title_case = True

renders
-------------------------
A list of ``TableDisplayLink``, ``TableDisplayEntityLink``, ``TableDisplayButton``, or ``TableDisplayRenderFormatCols`` objects. These are used to format target columns.

No two objects in the list can target the same column.

Unlike ``add_class``, these will create HTML elements nested within the ``<td>`` element.
::

    renders = [
        TableDisplayLink("'/some/url/'", 'gene'),
        TableDisplayEntityLink("entity")
    ]

add_class
-------------------------
A dictionary where the key is class name, and the value is a list of column names to apply to.

Unlike ``renders``, this applies the class directly to the ``<td>`` element, and does not create any DOM elements.
::

    add_class = {"bright-red": ['p_value']}

invisible_cols
-------------------------
A list of database column names, used to specify which columns to make available to the front end but not show on the webpage. For instance, an internal, numerical dataset_id may be needed for a link to the dataset, but does not need to be shown on the page. ::

    invisible_cols = ["dataset_id"]

sort_col
-------------------------
A string of the database column name, or a tuple of (column name, sort direction). used to specify which column the table should sort on by default.
If only the column name (a single string) is specified, the sort order will be descending if the column is numeric, ascending otherwise.
To override this default, pass in a tuple of (column name, "asc" or "desc")
::

    sort_col = "r_squared" # will sort descending (column is numeric)
    sort_col = "cell_line_name" # will sort ascending (column is not numeric)
    sort_col = ("r_squared", "asc")
    sort_col = ("r_squared", "desc")

additional_react_table_props
-------------------------
A dict of any additional options to add on to the ReactTable props. This should be used for one-off things that only apply to this particular table, and is unlikely to be useful to other tables. ::

    additional_react_table_props = {
        "noDataText": "No cell lines with these filters",
        "showPagination": False
    }

TableDisplayLink
^^^^^^^^^^^^^^^^^^^^^^^^^
::

    class TableDisplayLink(TableDisplayRender):
        def __init__(self, js_url_string, target_col):

Used to apply a link (``js_url_string``) to a certain database column name (``target_col``). This is useful in cases where the view to call in url_for is always the same, and the only variable part is the parameter. E.g., if the column is always a gene, or always a dataset. ::

    TableDisplayLink(js_url_for('cell_line.view_cell_line', cell_line_name="{data}"), 'cell_line_name')

``js_url_string`` is described below


TableDisplayEntityLink
^^^^^^^^^^^^^^^^^^^^^^^^^
::

    class TableDisplayEntityLink(TableDisplayRender):
        def __init__(self, target_cols, entity_type_column='type'):

Used to apply a link for a column with entities that can be either a gene or compound. This is a special case that TableDisplayLink is not suited for, because the view to call in url_for is different: depending on whether an entity is a gene or compound, you may want to call ``gene.view_gene`` or ``compound.view_compound``.

This additional information of which view to call is supplied by including an additional column, the ``type`` property of ``Entity``, in the data/query supplied to the DataTable, and make it invisible using ``invisible_cols``.

``target_col`` is the column to apply the link to.

``entity_type_column`` is the name of the column that is the ``type`` property of ``Entity``. By default this column is named 'type', but this option is included for convenience in case it is named something else


TableDisplayButton
^^^^^^^^^^^^^^^^^^^^^^^^^
::

    class TableDisplayButton(TableDisplayRender):
        def __init__(self, button_click_js, target_col, replace_data_with=None, html_data=None):


``button_click_js`` is literal javascript to execute when the button is clicked.

``target_col`` is the column to apply buttons to.

The default text on the button is the data in the column. If ``replace_data_with`` is specified, the text on the column will be the value of ``replace_data_with``

``html_data`` is a dict of any additional html attributes to add to the button DOM element. The values of the dict can be javascript variables enclosed in curly braces, e.g. those such as ``data`` and ``row`` provided by mRender should be written as.
An example dict can be:
::

    html_data = {
        'same_value_in_all_buttons' : 'same',
        'value_of_data_in_cell' : '{data}',
        'value_of_row_abc' : '{row[abc]}',
    }

Assuming that the index of row abc is 0 and ``replace_data_with`` is not specified, this will render the following button: ::

    <button type="button" class="btn btn-primary" autocomplete="off" same_value_in_all_buttons="same" value_of_data_in_cell="'+data+'" value_of_row_abc="'+row[0]+'">'+data+'</a>'


js_url_string and js_url_for
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
``js_url_string`` is a **literal javascript** that when evaluated, is the url link. e.g. ::

    js_url_string = "'/gene/' + data"
    TableDisplayLink(js_url_string, 'gene')

Specifically, this allows constructing links that are dependent on the value of the cell, which is available as the variable ``data`` in javascript. Thus in the above example, assuming the value of the cell in the table is "NRAS", the evaluated link will be /gene/NRAS.

``js_url_for`` was written so that there should be no need to manually construct these ``js_url_string`` s. Simply import and call ``js_url_for``, using it just as ``url_for`` is used, but with any javascript variables you want encapsulated in ``{}``. The following ``js_url_string`` is equivalent to the one above. ::

    from depmap.utilities.url_utils import js_url_for
    js_url_string = js_url_for('cell_line.view_cell_line', cell_line_name="{data}")

dataLoadCallback
=========================
The wide_data_table macro can take in a second, optional argument ::

    {% macro wide_data_table(table, dataLoadCallback=None) -%}

``dataLoadCallback`` is a string name of a javascript function (e.g. ``colorEverythingGreen``) to call after the ajax data from a jQuery DataTables has been loaded ::

    {{ partials.wide_data_table(mutation_table, "colorEverythingGreen") }}

Obtaining the jQuery DataTables object in the callback function
----------------------------------------------------------------

The DOM id of every data_table is set to  ``data_table_{{ table.name }}``, where table.name is the name used in the DataTable constructor (see `DataTable`_). In the callback function, the jQuery DataTables object can thus be obtained using ::

    var table = $("#data_table_{{  pearson.data_table.name }}").DataTable();

