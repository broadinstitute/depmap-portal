import pandas as pd
import collections
from depmap.interactive import common_utils
from depmap.interactive.views import regress_two_vars, format_regression_info_table


def compute_linear_regression(
    dimensions, output_dimensions, output_filters, output_metadata
):
    if "x" not in dimensions or "y" not in dimensions:
        return []

    if "color_property" in output_metadata:
        return get_linreg_by_group(
            output_dimensions,
            output_filters,
            output_metadata["color_property"]["values"],
        )

    if "color1" in output_filters or "color2" in output_filters:
        categorical_values = []
        has_color1 = "color1" in output_filters
        has_color2 = "color2" in output_filters
        color1_name = output_filters["color1"]["name"] if has_color1 else None
        color2_name = output_filters["color2"]["name"] if has_color2 else None

        for i in range(0, len(output_dimensions["x"]["values"])):
            color1 = output_filters["color1"]["values"][i] if has_color1 else False
            color2 = output_filters["color2"]["values"][i] if has_color2 else False

            if color1 and color2:
                categorical_values.append(f"Both ({color1_name} & {color2_name})")
            elif color1:
                categorical_values.append(color1_name)
            elif color2:
                categorical_values.append(color2_name)
            else:
                categorical_values.append(None)

        return get_linreg_by_group(
            output_dimensions, output_filters, categorical_values,
        )

    use_visible_filter = "visible" in output_filters
    x_values = []
    y_values = []

    for i in range(0, len(output_dimensions["x"]["values"])):
        visible = output_filters["visible"]["values"][i] if use_visible_filter else True
        x_value = output_dimensions["x"]["values"][i]
        y_value = output_dimensions["y"]["values"][i]
        if visible and x_value is not None and y_value is not None:
            x_values.append(x_value)
            y_values.append(y_value)

    x = pd.Series(x_values)
    y = pd.Series(y_values)
    regression_info = pd.Series([_regress_two_vars_safe(x, y)])
    table = format_regression_info_table(regression_info, [0])

    return common_utils.get_lin_reg_info_list(table)


def get_linreg_by_group(output_dimensions, output_filters, categorical_values):
    use_visible_filter = "visible" in output_filters
    values_by_group = {}
    groups = {}
    i = 0

    # This is a list of labels that is equal in length to each dimension
    for group_label in categorical_values:
        if group_label not in values_by_group:
            values_by_group[group_label] = {"x": [], "y": []}

        visible = output_filters["visible"]["values"][i] if use_visible_filter else True
        x_value = output_dimensions["x"]["values"][i]
        y_value = output_dimensions["y"]["values"][i]
        if visible and x_value is not None and y_value is not None:
            values_by_group[group_label]["x"].append(x_value)
            values_by_group[group_label]["y"].append(y_value)
        i += 1

    for group_label, group_values in values_by_group.items():
        if len(group_values["x"]) > 0:
            x = pd.Series(group_values["x"])
            y = pd.Series(group_values["y"])
            group = _regress_two_vars_safe(x, y)
            group[group_label] = group_label
            groups[group_label] = group

    removed_group = None
    if None in groups:
        removed_group = groups.pop(None)

    groups = collections.OrderedDict(sorted(groups.items()))
    if removed_group:
        groups[None] = removed_group

    regression_info = pd.Series(groups)
    table = format_regression_info_table(
        regression_info, groups.keys(), must_have_group_column=True
    )
    linreg_by_group = common_utils.get_lin_reg_info_list(table)
    linreg_by_group.reverse()

    return linreg_by_group


def _regress_two_vars_safe(x, y):
    try:
        return regress_two_vars(x, y)
    except ValueError:
        # In the unlikely event that all the points are identical, return only
        # the number of points
        return {
            "length": len(x),
            "pearson": None,
            "spearman": None,
            "linear_regression": None,
        }
