from depmap.utilities.url_utils import js_url_for
from depmap.partials.entity_summary.factories import get_entity_summary_for_view
from depmap.dataset.models import BiomarkerDataset
from depmap.enums import BiomarkerEnum
from depmap.constellation.utils import ConnectivityOption, SimilarityOption
import depmap.celfie.utils as celfie_utils


def format_summary(
    summary_options: list[dict[str, str]],
    first_entity,
    first_dep_enum_name,
    default_size_enum=None,
    default_color=None,
    show_auc_message=False,
):
    summary = {
        "figure": get_entity_summary_for_view(
            first_entity, first_dep_enum_name, default_size_enum, default_color
        ),
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


def format_celfie(entity_label: str, dependency_datasets):
    # Define datasets to pass to celfie

    celfie = {
        "entity_name": entity_label,
        "dependency_datasets": dependency_datasets,
        "similarity_options": [
            {"value": s.option_id, "label": s.label}
            for s in SimilarityOption
            if s.option_id
            is not SimilarityOption.expression.option_id  # Don't include CCLE Coexpression
        ],
        "color_options": [
            {"value": "effect", "label": "Correlation",},
            {"value": "direction", "label": "Direction",},
            {"value": "-log10(P)", "label": "-log10(P)",},
            {"value": "task", "label": "Feature",},
        ],
        "connectivity_options": [
            {"value": option.value, "label": option.name.capitalize()}
            for option in ConnectivityOption
        ],
        "datasets": [
            {
                "value": dataset,
                "label": BiomarkerDataset.get_dataset_by_name(dataset).display_name,
            }
            for dataset in celfie_utils.celfie_datasets
        ],
    }
    return celfie
