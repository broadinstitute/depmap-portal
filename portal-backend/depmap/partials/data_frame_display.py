class DataFrameDisplay:
    def __init__(
        self, cols, renames=None, replace_underscores=True, make_title_case=True
    ):
        """
        Display specification for DataTable
        :param cols: List of cols to display, in order to display
        :param renames: Dict of columns to rename
        :param replace_underscores: Replaces underscores with spaces for any column not specified in renames
        :param make_title_case: Capitalizes every word for any column not specified in renames
        """
        if renames is None:
            # default to None in the signature since a dict is mutable.
            renames = {}

        specified_renames = renames.keys()
        all_renames = {}
        # going for clarity over syntatical sugar
        for col_name in cols:
            if col_name in specified_renames:
                all_renames[col_name] = renames[col_name]
            elif replace_underscores or make_title_case:
                new_name = col_name
                if replace_underscores:
                    new_name = new_name.replace("_", " ")
                if make_title_case:
                    new_name = new_name.title()
                all_renames[col_name] = new_name

        self.cols = cols
        self.renames = all_renames
