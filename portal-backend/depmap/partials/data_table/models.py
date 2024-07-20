from json import dumps as json_dumps
import re

import pandas as pd
from flask import url_for
from sqlalchemy import types

from depmap.partials.data_frame_display import DataFrameDisplay


def convert_js_row_col_to_index(js_string, col_indices):
    """
    This needs a better name
    :param js_string: 
    :param col_indices: 
    :return: 
    """
    for name, index in col_indices.items():
        js_string = js_string.replace("row[{}]".format(name), "row[{}]".format(index))
    return js_string


def convert_js_vars(js_string):
    """
    Used to convert js variables enclosed in {} to string concetenation of the js variable
    E.g. {abc} is converted to '+abc+'
    WARNING: Use of this function relies on single quotes being the start and end of the js string literal
    I.e. in js, 'aa'+abc+'aa' is a valid string contenation, but "aa'+abc+'aa" is not
    
    The implementation of this is different from js_url_for, because the url_for function encodes strings/makes url-safe
    :param js_string: string of literal javascript, with js variables enclosed in {}
    :return: 
    """
    return re.sub("{(.*?)}", lambda x: "'+" + x.group()[1:-1] + "+'", js_string)


class TableDisplayRender:  # fixme better class name
    def __init__(self, render_function, target_cols):
        """
        :param render_function: function that returns literal javascript to inject into the value in the table cell.
        'data' is the variable name for the value of the cell 
        :param target_cols: names of columns to target. order is irrelevant
        """
        self.render_function = render_function
        self.target_cols = target_cols

    def data_for_partial(self, col_indices):
        """
        Handles conversion of column names to indices
        """
        injection_dict = {
            "render": self.render_function(col_indices),
            "target_cols": [col_indices[col] for col in self.target_cols],
        }
        return injection_dict


class TableDisplayRenderFormatCols(TableDisplayRender):
    def __init__(self, render_function, target_cols):
        """
        Same as TableDisplayRender, but runs convert_js_row_col_to_index on the output of render_function
        """
        super().__init__(
            lambda col_indices: convert_js_row_col_to_index(
                render_function(), col_indices
            ),
            target_cols,
        )


class TableDisplayLink(TableDisplayRender):  # fixme better class name
    def __init__(
        self, js_url_string, target_col, replace_data_with=None, open_in_new_tab=False
    ):
        """
        :target_col: column name of column to target
        :param js_url_string: string literal of js that when evaluated, is the url
        """

        def render_function(col_indices):
            data = "data"
            if replace_data_with is not None:
                data = replace_data_with

            if open_in_new_tab:
                return "'<a href=\"'+{}+'\" target=\"_blank\">'+{}+'</a>'".format(
                    js_url_string, data
                )
            else:
                return "'<a href=\"'+{}+'\">'+{}+'</a>'".format(js_url_string, data)

        super().__init__(render_function, [target_col])


class TableDisplayEntityLink(TableDisplayRender):
    def __init__(
        self, target_cols, entity_type_column="Type", url_label_column="Url Label"
    ):
        """
        :param entity_type_column: column name of column containing the entity type. Used as keys in url_roots 
        :param target_cols: 
        """

        def render_function(col_indices):
            render_html = "'<a href=\"'+urlRoots[row['{}']]+row['{}']+'\">'+data+'</a>'".format(
                entity_type_column, url_label_column
            )
            return render_html

        super().__init__(render_function, [target_cols])
        self.url_roots = {
            "gene": url_for("gene.view_gene", gene_symbol=""),
            "compound": url_for("compound.view_compound", name=""),
        }

    def data_for_partial(self, col_indices):
        injection_dict = super().data_for_partial(col_indices)
        injection_dict["url_roots"] = self.url_roots
        return injection_dict


class TableDisplayButton(TableDisplayRender):
    def __init__(
        self, button_click_js, target_col, replace_data_with=None, html_data=None
    ):
        """
        WARNING: Currently a data table can only have one of these because button_click_event_handler is hardcoded to put the click handler on just the 'button' element. Need to refactor to add identifiers if want to use more than one of these

        :target_col: column name of column to target
        :html_data: dict of custom html attributes and their values. Any js variables should be enclosed in curly braces. row[<col name>] e.g. row[z_score] will be convered to row[<col index>] e.g. row[0] which is valid variable that mRender makes available
        """

        def render_function(col_indices):
            data = "data"

            if html_data is not None:
                custom_attributes_list = []
                for attribute, value in html_data.items():
                    value = convert_js_row_col_to_index(value, col_indices)
                    value = convert_js_vars(value)
                    html_string = '{}="{}"'.format(attribute, value)
                    custom_attributes_list.append(html_string)
                custom_attributes = " ".join(custom_attributes_list)
            else:
                custom_attributes = ""

            if replace_data_with is not None:
                data = replace_data_with

            button_html = """'<button type="button" class="btn btn-default btn-xs" {custom_attributes}>'+{data}+'</button>'""".format(
                data=data, custom_attributes=custom_attributes
            )
            return button_html

        super().__init__(render_function, [target_col])

        self.button_click_js = button_click_js


class TableDisplay(DataFrameDisplay):
    def __init__(
        self,
        cols,
        factory_params,
        renames=None,
        format=None,
        replace_underscores=True,
        make_title_case=True,
        renders=None,
        add_class=None,
        invisible_cols=None,
        sort_col=None,
        additional_react_table_props={},
        default_cols_to_show=None,
    ):
        """
        See /documentation/data_table.rst
        """
        super().__init__(cols, renames, replace_underscores, make_title_case)
        self.format = format if format is not None else {}
        self.renders = renders if renders else []
        self.add_class = add_class if add_class else {}
        self.invisible_cols = invisible_cols if invisible_cols else []
        self.sort_col = sort_col
        self.factory_params = factory_params
        self.additional_react_table_props = additional_react_table_props
        self.default_cols_to_show = default_cols_to_show


class DataTableData:
    def __init__(self, get_column_types, get_data):
        """
        :param get_column_types: Returns a dict of column_name: column_type 
        :param get_data: Returns a pandas df
        """
        self.get_column_types = get_column_types
        self.get_data = get_data


class DataTable:
    def __init__(
        self, data_or_query, table_display, name, filename
    ):  # fixme move links_df to TableDisplay
        """
        Takes in a dataframe and other information, and generates rows and cols ready for injection for data_table macro
        Note: Instantiation of a DataTable induces formatting, coercion to strings, etc.
        Specifically, format() and fillna convert columns to strings. This messes with the typing of the df.
        Any numerical, null checking, etc. should be done before instantiation of this object
        :param data: sqlalchemy query or object of type DataTableData
        :param table_display: TableDisplay object to specify formatting (which cols to show, etc.)
        :param name: identifier for injection
        See /documentation/data_table.rst
        """
        self.data_or_query = data_or_query
        self.original_cols = table_display.cols
        self.renamed_cols = [
            table_display.renames[col] if col in table_display.renames else col
            for col in self.original_cols
        ]

        self.format = {
            table_display.renames[col] if col in table_display.renames else col: v
            for col, v in table_display.format.items()
        }  # convert keys to renamed columns
        self.name = name
        self.filename = filename
        self.factory_params = table_display.factory_params

        col_indices = {col: index for index, col in enumerate(table_display.cols)}

        # Format mRender options
        renders = []
        additional_js = []
        for render in table_display.renders:
            renders.append(render.data_for_partial(col_indices))
            if isinstance(render, TableDisplayButton):
                # curly braces are escaped by using double curly braces
                button_click_event_handler = "$('#data_table_{}').on('click', 'button', function () {{{}}})".format(
                    self.name, render.button_click_js
                )
                additional_js.append(button_click_event_handler)

        # flatten the lists of target cols and check that the target columns do not clash with each other
        all_cols = [index for render in renders for index in render["target_cols"]]
        assert len(all_cols) == len(
            set(all_cols)
        ), "Targeted cols are repeated, they will override each other. " + str(renders)
        self.renders = renders
        self.additional_js = additional_js

        # Determine whether columns are numeric
        numeric_col_indices = []
        if isinstance(self.data_or_query, DataTableData):
            column_types = data_or_query.get_column_types()
        else:
            column_types = {
                col.name: col.type for col in data_or_query.statement.columns
            }

        for col in table_display.cols:
            if DataTable._is_numeric_type(column_types[col]):
                numeric_col_indices.append(col_indices[col])
        self.numeric_col_indices = numeric_col_indices

        self.add_class = {
            class_name: [col_indices[col] for col in cols]
            for class_name, cols in table_display.add_class.items()
        }
        self.invisible_cols = [col_indices[col] for col in table_display.invisible_cols]

        if table_display.sort_col is None:
            self.sort_col = None
            self.sort_order = None
        elif isinstance(table_display.sort_col, tuple):
            assert len(table_display.sort_col) == 2
            self.sort_col = col_indices[table_display.sort_col[0]]
            self.sort_order = table_display.sort_col[1]
        else:
            self.sort_col = col_indices[table_display.sort_col]
            self.sort_order = None

        self.additional_react_table_props = table_display.additional_react_table_props
        self.default_cols_to_show = table_display.default_cols_to_show

    @staticmethod
    # sqlalchemy.sql.sqltypes are instances of sqlalchemy.types
    def _is_numeric_type(column_type):
        return (
            isinstance(column_type, types.Integer)
            or isinstance(column_type, types.Float)
            or isinstance(column_type, types.Numeric)
        )

    @property
    def _df(self):
        """
        Function that forces query and formatting of df
        Cache result on self
        """
        if hasattr(self, "df"):
            return self.df

        if isinstance(self.data_or_query, DataTableData):
            df = self.data_or_query.get_data()[self.original_cols]
        else:
            df = pd.read_sql(
                self.data_or_query.statement, self.data_or_query.session.connection()
            )[self.original_cols]

        # rename columns
        # this is kinda scary, and relies on [self.original_cols] in the pd.read_sql line above
        # but then it lets us have only once source of renamed_cols, instead of renaming in two places
        # tested in test_order_rename_format
        # although a bunch of other tests will break first (due to different number of columns) if [self.original_cols] is removed from the pd.read_sql line
        df.columns = self.renamed_cols
        df.fillna(value="", inplace=True)

        self.df = df
        return df

    @property
    def _cols(self):
        """
        :return: List of columns
        """
        return self.renamed_cols

    def json_data(self):
        """
        :return: list (each row) of lists (each col) for the ajax data_table
        Apparently if you render html strings they will be literally rendered as html
        """
        df = self._df

        # format values in the df
        for col in self.format.keys():
            print(col)
            df[col] = df[col].apply(
                lambda x: self.format[col].format(x) if not pd.isnull(x) else ""
            )

        return json_dumps({"data": df.values.tolist(), "cols": self.original_cols})

    def data_for_ajax_partial(self):
        """
        Returns everything for direct injection for an ajax table 
        """

        injection_dict = {
            "name": self.name,
            "ajax_url": url_for("partials.data_table_json_data", **self.factory_params),
            "download_url": url_for(
                "partials.data_table_download", **self.factory_params
            ),
            "cols": self._cols,
            "display": {
                "numeric_col_indices": self.numeric_col_indices,
                "add_class": self.add_class,
                "renders": self.renders,
                "invisible_cols": self.invisible_cols,
                "sort_col": self.sort_col,
                "sort_order": self.sort_order,
                "additional_js": self.additional_js,
                "additional_react_table_props": self.additional_react_table_props,
                "default_cols_to_show": self.default_cols_to_show,
            },
        }

        return injection_dict

    def data_for_ajax_partial_temp(self):
        """
        Returns everything for direct injection for an ajax table 
        """

        injection_dict = {
            "name": self.name,
            "ajax_url": url_for("partials.data_table_json_data", **self.factory_params),
            "download_url": url_for(
                "partials.data_table_download_temp", **self.factory_params
            ),
            "cols": self._cols,
            "display": {
                "numeric_col_indices": self.numeric_col_indices,
                "add_class": self.add_class,
                "renders": self.renders,
                "invisible_cols": self.invisible_cols,
                "sort_col": self.sort_col,
                "sort_order": self.sort_order,
                "additional_js": self.additional_js,
                "additional_react_table_props": self.additional_react_table_props,
                "default_cols_to_show": self.default_cols_to_show,
            },
        }

        return injection_dict
