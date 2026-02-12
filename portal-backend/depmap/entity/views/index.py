from depmap.utilities.url_utils import js_url_for


def format_summary(
    summary_options: list[dict[str, str]],
    first_entity,
    first_dep_enum_name,
    default_size_enum=None,
    default_color=None,
    show_auc_message=False,
):
    """Only used for gene summary, not compound summary"""
    summary = {
        "figure": "",  # This "figure" param isn't used anymore and should be removed
        "summary_options": summary_options,
        "ajax_url": js_url_for(
            "partials.entity_summary_json_data",
            entity_id="{selectedEntity}",
            dep_enum_name="{selectedDataset}",
            size_biom_enum_name=default_size_enum.name
            if default_size_enum is not None
            else "none",
            color=default_color if default_color is not None else "none",
        ),
        "show_auc_message": show_auc_message,
        "size_biom_enum_name": default_size_enum.name
        if default_size_enum is not None
        else None,
        "color": default_color if default_color is not None else None,
    }
    return summary
