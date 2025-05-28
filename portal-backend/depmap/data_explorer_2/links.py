from flask import current_app, url_for
from json import dumps as json_dumps
from oauth2client.service_account import ServiceAccountCredentials
from depmap import data_access
from depmap.utilities.sign_bucket_url import sign_url
from depmap.vector_catalog.models import SliceSerializer
from depmap.entity.models import Entity
from depmap.cell_line.models import Lineage


def get_tutorial_link():
    return "https://sites.google.com/broadinstitute.org/depmap-de2-tutorial/home"


def get_plot_link(x, y, color, visible_filter, regression_line):
    params = {}

    if x:
        dataset_id, feature, _ = SliceSerializer.decode_slice_id(x)
        params["xDataset"] = dataset_id
        params["xFeature"] = _get_feature_label(feature, dataset_id)

    if y:
        dataset_id, feature, _ = SliceSerializer.decode_slice_id(y)
        params["yDataset"] = dataset_id
        params["yFeature"] = _get_feature_label(feature, dataset_id)

    if color:
        dataset_id, feature, _ = SliceSerializer.decode_slice_id(color)

        if dataset_id == "context":
            params["color1"] = _context_to_json(feature)
        else:
            params["color_property"] = color

    if regression_line == "true":
        params["regressionLine"] = "true"

    if visible_filter:
        _, feature, _ = SliceSerializer.decode_slice_id(visible_filter)
        params["filter"] = _context_to_json(feature)

    return url_for("data_explorer_2.view_data_explorer_2", **params)


def _get_feature_label(entity_id, dataset_id):
    feature_type = data_access.get_dataset_feature_type(dataset_id)

    if feature_type:
        entity = Entity.get_by_id(entity_id, False)
        if entity:
            return entity.label

    return entity_id


def _context_to_json(context_name):
    lineage_level = "1"

    for level in ["2", "3"]:
        for lineage, _ in Lineage.get_lineage_ids_by_level(level):
            if lineage == context_name:
                lineage_level = level

    return json_dumps(
        {
            "name": context_name,
            "context_type": "depmap_model",
            "expr": {
                "==": [{"var": f"slice/lineage/{lineage_level}/label"}, context_name,]
            },
        }
    )
