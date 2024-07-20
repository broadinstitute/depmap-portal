from multidict import MultiDict
import pytest
from unittest.mock import MagicMock
import urllib.parse
import json

from breadbox_client.models import (
    FeatureResponse,
    FeatureResponseValues,
)
from depmap import data_access
from depmap.dataset.models import BiomarkerDataset
from depmap.interactive.models import Feature
from depmap.vector_catalog.trees import InteractiveTree
from depmap.interactive.views import option_used
from depmap.interactive.config.utils import __get_config
from tests.depmap.interactive.fixtures import *


def is_number(item):
    """
    Helper function to test if a string is a number.
    Prevents front end from receiving things like NaN which it cannot parse and will error out
    """
    if isinstance(item, int) or isinstance(item, float):
        return True
    if item == "NaN":
        return False
    try:
        float(item)
        return True
    except ValueError:
        return False


@pytest.mark.parametrize(
    "xDataset, xFeature, yDataset, yFeature, expected",
    [
        (
            standard_aliased_dataset_id,
            standard_aliased_dataset_feature,
            standard_aliased_dataset_id,
            standard_aliased_dataset_feature,
            10,
        )
    ],
)
def test_basic_get_features_structure(
    interactive_db_mock_downloads, xDataset, xFeature, yDataset, yFeature, expected
):
    """
    Test returns the properties and 'type' of data expected
    """
    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(xDataset, xFeature),
            ),
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(yDataset, yFeature),
            ),
            ("groupBy", ""),
            ("filter", ""),
            ("computeLinearFit", True),
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        # test without grouping/filtering
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        for key in {"linreg_by_group", "depmap_ids", "features", "group_by", "groups"}:
            assert key in response

        assert len(response["features"]) == 2

        assert response["group_by"] is ""
        assert len(response["linreg_by_group"]) == 1
        assert all(isinstance(item, str) for item in response["linreg_by_group"][0])


def test_get_features_values(interactive_db_mock_downloads):
    """
    Test that get_features endpoint has the same values as the interactive_utils get_row_of_values return
    Correctness of interactive_utils get_row_of_values is handled indirectly in test_interactive_utils.py::test_get_row_of_values, and more thoroughly/directly in tests/depmap/partials/test_models.py::test_get_cell_lines
    """
    other_features = {"small-msi-dataset-aa84.4": "isMSI", "rppa": "AMPK_alpha"}
    tested = 0
    skipped = 0

    with interactive_db_mock_downloads.app.test_client() as c:
        for dataset_id in __get_config().all_datasets:
            if data_access.is_continuous(dataset_id) and not data_access.is_categorical(
                dataset_id
            ):
                tested += 1
                if dataset_id in other_features:  # these don't have MED1
                    feature = other_features[dataset_id]
                else:
                    feature = "MED1"  # present in all datasets except the ones in other_features
                expected = data_access.get_row_of_values(dataset_id, feature)
                params = [
                    (
                        "features",
                        InteractiveTree.get_id_from_dataset_feature(
                            dataset_id, feature
                        ),
                    ),
                    (
                        "features",
                        InteractiveTree.get_id_from_dataset_feature(
                            dataset_id, feature
                        ),
                    ),
                ]
                r = c.get(
                    "/interactive/api/get-features?" + urllib.parse.urlencode(params)
                )
                assert r.status_code == 200
                response = json.loads(r.data.decode("utf8"))

                x = response["features"][0]["values"]

                # not coloring by mutation, labels should be equal
                cell_line_lists = {
                    "cell_line_names": [
                        feature["label"] for feature in response["features"]
                    ],
                    "values": x,
                    "depmap_ids": response["depmap_ids"],
                }

                for value, depmap_id in zip(x, cell_line_lists["depmap_ids"]):
                    assert expected[depmap_id] == value
            else:
                skipped += 1

    # sanity checks that we don't skip everything
    assert tested > 0


@pytest.mark.parametrize(
    "color, filter, expected",
    [
        ("context", "None", [1, 9]),
        ("mutations_prioritized", "None", [2, 7, 1]),
        ("mutations_prioritized", "context", [1]),
        ("None", "context", [1]),
        ("None", "custom_cell_lines", [1]),
    ],
)
def test_get_features_group_filter(
    interactive_db_mock_downloads, color, filter, expected
):
    """
    Test returns correct plot points
    """
    datasets = {  # for test setup
        "context": {"dataset": context_dataset_id, "feature": context_dataset_feature},
        "mutations_prioritized": {
            "dataset": BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            "feature": mutations_dataset_feature,
        },
        "custom_cell_lines": {
            "dataset": custom_cell_line_group_dataset_id,
            "feature": custom_cell_line_group_feature,
        },
        "None": {"dataset": "", "feature": ""},
    }

    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        # first, request without color or filter
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        total = len(
            response["features"][0]["values"]
        )  # first, ask for total before any color or filter is applied

        params.update(
            [
                (
                    "groupBy",
                    InteractiveTree.get_id_from_dataset_feature(
                        datasets[color]["dataset"], datasets[color]["feature"]
                    ),
                ),
                (
                    "filter",
                    InteractiveTree.get_id_from_dataset_feature(
                        datasets[filter]["dataset"], datasets[filter]["feature"]
                    ),
                ),
                ("computeLinearFit", True),
            ]
        )

        # request with color/filter
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        response = json.loads(r.data.decode("utf8"))

        x_feature: Feature = response["features"][0]

        for index, expected_length in enumerate(expected):
            # Grouping occurs on the frontend using depmap id's in "groups." Check to see if the number of depamp_ids
            # in each group makes sense.
            x = response["groups"][index]["depmap_ids"]
            assert len(x) == expected_length

        if filter == "None":
            # coloring should not drop any points
            assert sum(expected) == total


@pytest.mark.parametrize(
    "color, filter",
    [
        ("None", "None"),
        ("context", "None"),
        ("mutations_prioritized", "None"),
        ("mutations_prioritized", "context"),
        ("None", "context"),
        ("None", "custom_cell_lines"),
    ],
)
# fixme not testing values yet
def test_get_features_table_stats(interactive_db_mock_downloads, color, filter):
    """
    Test that runs without error, and returns appropriate headers
    """
    datasets = {
        "context": {"dataset": context_dataset_id, "feature": context_dataset_feature},
        "mutations_prioritized": {
            "dataset": BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            "feature": mutations_dataset_feature,
        },
        "custom_cell_lines": {
            "dataset": custom_cell_line_group_dataset_id,
            "feature": custom_cell_line_group_feature,
        },
        "None": {"dataset": "", "feature": ""},
    }

    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "groupBy",
                InteractiveTree.get_id_from_dataset_feature(
                    datasets[color]["dataset"], datasets[color]["feature"]
                ),
            ),
            (
                "filter",
                InteractiveTree.get_id_from_dataset_feature(
                    datasets[filter]["dataset"], datasets[filter]["feature"]
                ),
            ),
            ("computeLinearFit", True),
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        assert "linreg_by_group" in response

        # only happens if there is color, but may not happen if the coloring is applied but everything is one group
        if len(response["linreg_by_group"]) > 1:
            assert color != "None"


def test_get_features_mutation_labels(interactive_db_mock_downloads):
    """
    When color by mutation, mutation information should be added to the label
    Merely tests for presence of newline
    DOES NOT check if label is correct
    """
    datasets = {  # share structure with other test_get_features test in terms of how the taiga id is hardcoded
        "mutations_prioritized": {
            "dataset": BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            "feature": mutations_dataset_feature,
        }
    }

    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "groupBy",
                InteractiveTree.get_id_from_dataset_feature(
                    datasets["mutations_prioritized"]["dataset"],
                    datasets["mutations_prioritized"]["feature"],
                ),
            ),
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        for i, feature in enumerate(response["features"]):
            labels = response["groups"][i]["depmap_ids"]

            assert all(["ACH-" in label for label in labels])


def test_get_features_cell_line_metadata(interactive_db_mock_downloads):
    """
    When requested, cell line metadata features (which don't have slice IDs) should be returned. 
    """
    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            ("features", "primary_disease"),
            ("features", "cell_line_display_name"),
            ("features", "lineage_display_name"),
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        # Make sure the response contains all requested features
        features = response["features"]
        assert len(features) == 4
        feature_ids = [f["feature_id"] for f in features]
        assert "primary_disease" in feature_ids
        assert "cell_line_display_name" in feature_ids
        assert "lineage_display_name" in feature_ids

        # Make sure each feature has the expected number of values
        depmap_id_count = len(response["depmap_ids"])
        assert depmap_id_count > 0
        feature_values = [f["values"] for f in features]
        for value_set in feature_values:
            assert len(value_set) == depmap_id_count


def test_get_features_without_y(interactive_db_mock_downloads):
    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            )
            # no y
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        # test without grouping/filtering
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        assert response.keys() == {
            "linreg_by_group",
            "depmap_ids",
            "features",
            "group_by",
            "groups",
            "supplement_details",
        }
        assert (
            len(response["features"][0]["values"]) == 10
        )  # x is always at index 0 for data explorer
        assert response["linreg_by_group"] == []

        assert isinstance(response["features"][0]["values"][0], float)


@pytest.mark.parametrize(
    "color, filter, expected",
    [
        ("context", "None", [1, 9]),
        ("mutations_prioritized", "None", [2, 7, 1]),
        ("mutations_prioritized", "context", [1]),
        ("None", "context", [1]),
    ],
)
def test_get_features_without_y_group_filter(
    interactive_db_mock_downloads, color, filter, expected
):
    """
    Test that x-only (no y) works correctly with color and filter
        Separates into traces by color
        Removes filtered points
    Heavily copied from test_get_features_group_filter
    """
    datasets = {
        "context": {"dataset": context_dataset_id, "feature": context_dataset_feature},
        "mutations_prioritized": {
            "dataset": BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            "feature": mutations_dataset_feature,
        },
        "None": {"dataset": "", "feature": ""},
    }

    params = MultiDict(
        [
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            )
            # no y
        ]
    )

    with interactive_db_mock_downloads.app.test_client() as c:
        # first, request without color or filter
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))

        total = len(
            response["features"][0]["values"]
        )  # first, ask for total before any color or filter is applied

        params.update(
            [
                (
                    "groupBy",
                    InteractiveTree.get_id_from_dataset_feature(
                        datasets[color]["dataset"], datasets[color]["feature"]
                    ),
                ),
                (
                    "filter",
                    InteractiveTree.get_id_from_dataset_feature(
                        datasets[filter]["dataset"], datasets[filter]["feature"]
                    ),
                ),
            ]
        )

        # request with color/filter
        r = c.get("/interactive/api/get-features?" + urllib.parse.urlencode(params))
        response = json.loads(r.data.decode("utf8"))

        assert len(response["groups"]) == len(expected)

        x_features: Feature = response["features"][0]

        for index, expected_length in enumerate(expected):
            assert len(response["groups"][index]["depmap_ids"]) == expected[index]

        if filter == "None":
            # coloring should not drop any points
            assert sum(expected) == total


@pytest.mark.parametrize(
    "optionFeature, optionDataset, dataset_config_key_name, expected, purpose",
    [
        (
            standard_aliased_dataset_feature,
            standard_aliased_dataset_id,
            "DATASETS",
            True,
            "Ok dataset and feature",
        ),
        (
            "invalid feature",
            standard_aliased_dataset_id,
            "DATASETS",
            False,
            "Bad feature",
        ),
        (
            standard_aliased_dataset_feature,
            "invalid dataset",
            "DATASETS",
            False,
            "Bad dataset",
        ),
        (
            standard_aliased_dataset_feature,
            standard_aliased_dataset_id,
            "COLOR_DATASETS",
            False,
            "Bad color dataset",
        ),
        (
            "None",
            standard_aliased_dataset_id,
            "DATASETS",
            False,
            "No specified feature",
        ),
        (None, standard_aliased_dataset_id, "DATASETS", False, "No specified feature"),
        ("", standard_aliased_dataset_id, "DATASETS", False, "No specified feature"),
        (
            "undefined",
            standard_aliased_dataset_id,
            "DATASETS",
            False,
            "No specified feature",
        ),
        (
            standard_aliased_dataset_feature,
            "None",
            "DATASETS",
            False,
            "No specified dataset",
        ),
        (
            standard_aliased_dataset_feature,
            None,
            "DATASETS",
            False,
            "No specified dataset",
        ),
        (
            standard_aliased_dataset_feature,
            "",
            "DATASETS",
            False,
            "No specified dataset",
        ),
        (
            standard_aliased_dataset_feature,
            "undefined",
            "DATASETS",
            False,
            "No specified dataset",
        ),
        (
            standard_aliased_dataset_feature,
            standard_aliased_dataset_id,
            None,
            True,
            "No dataset config key",
        ),
    ],
)
def test_option_used(
    interactive_db_mock_downloads,
    optionFeature,
    optionDataset,
    dataset_config_key_name,
    expected,
    purpose,
):
    with interactive_db_mock_downloads.app.test_client() as c:
        if dataset_config_key_name is None:
            assert option_used(optionFeature, optionDataset) == expected
        else:
            assert (
                option_used(optionFeature, optionDataset, dataset_config_key_name)
                == expected
            )


def test_empty_case_shape(interactive_db_mock_downloads):
    """
    Test that the shape of the empty case is up to date with the shape of the case where points are returned
    It's a separate if block, that has had a tendency to get out of sync
    """

    with interactive_db_mock_downloads.app.test_client() as c:
        option_used_params = {
            "y": InteractiveTree.get_id_from_dataset_feature(
                standard_aliased_dataset_id, standard_aliased_dataset_feature
            ),
            "x": InteractiveTree.get_id_from_dataset_feature(
                standard_aliased_dataset_id, standard_aliased_dataset_feature
            ),
        }
        r = c.get(
            "/interactive/api/get-features?"
            + urllib.parse.urlencode(option_used_params)
        )
        assert r.status_code == 200
        response_with_points = json.loads(r.data.decode("utf8"))

        empty_case_params = {
            "y": InteractiveTree.get_id_from_dataset_feature("", ""),
            "x": InteractiveTree.get_id_from_dataset_feature("", ""),
        }
        r = c.get(
            "/interactive/api/get-features?" + urllib.parse.urlencode(empty_case_params)
        )
        assert r.status_code == 200
        empty_response = json.loads(r.data.decode("utf8"))

        assert response_with_points.keys() == empty_response.keys()
        assert all(
            [
                key in list(response_with_points.keys())
                for key in list(empty_response.keys())
            ]
        )


def test_get_features_breadbox_only(
    interactive_db_mock_downloads, mock_breadbox_client
):
    """
    Test that the get_features endpoint has the same behavior when a breadbox feature is requested. 
    Validate that axis_label and feature_id values are constructed as expected. 
    """
    mock_breadbox_response = [
        FeatureResponse(
            feature_id="feature_id1",
            dataset_id="dataset_id1",
            values=FeatureResponseValues.from_dict(
                {"ACH-00001": 0.1, "ACH-00002": 0.2, "ACH-00003": 0.3,}
            ),
            label="feature1",
            units="cm",
            dataset_label="dataset1",
        ),
        FeatureResponse(
            feature_id="feature_id2",
            dataset_id="dataset_id2",
            values=FeatureResponseValues.from_dict(
                {"ACH-00002": 2, "ACH-00003": 3, "ACH-00004": 4,}
            ),
            label="feature2",
            units="meters",
            dataset_label="dataset2",
        ),
    ]

    # Mock the breadbox client response
    mock_breadbox_client.get_feature_data = MagicMock(
        return_value=mock_breadbox_response
    )

    # Make a request to get-features
    with interactive_db_mock_downloads.app.test_client() as c:
        params = [
            ("features", "breadbox/dataset_id2/feature_id2"),
            ("features", "breadbox/dataset_id1/feature_id1"),
        ]
        response = c.get(
            "/interactive/api/get-features?" + urllib.parse.urlencode(params)
        )
        assert response.status_code == 200
        response_val = json.loads(response.data.decode("utf8"))

        actual_depmap_ids = response_val["depmap_ids"]
        assert actual_depmap_ids == ["ACH-00002", "ACH-00003"]

        # Features should be listed in the order requested
        actual_features: list[dict] = response_val["features"]
        assert len(actual_features) == 2
        assert actual_features[0] == {
            "axis_label": "feature2 meters<br>dataset2",
            "feature_id": "breadbox/dataset_id2/feature_id2",
            "label": "feature2",
            "values": [2, 3],
        }
        assert actual_features[1] == {
            "axis_label": "feature1 cm<br>dataset1",
            "feature_id": "breadbox/dataset_id1/feature_id1",
            "label": "feature1",
            "values": [0.2, 0.3],
        }

        # check that breadbox was called with the correct params
        mock_breadbox_client.get_feature_data.assert_called_with(
            dataset_ids=["dataset_id2", "dataset_id1"],
            feature_ids=["feature_id2", "feature_id1"],
        )


def test_get_features_breadbox_and_legacy_combined(
    interactive_db_mock_downloads, mock_breadbox_client
):
    """
    Test that the get_features endpoint correctly combines data from multiple sources. 
    If features are requested from both breadbox and the legacy portal, the response should
    contain data from both. 
    """

    mock_breadbox_response = [
        FeatureResponse(
            feature_id="feature_id1",
            dataset_id="dataset_id1",
            values=FeatureResponseValues.from_dict(
                {"ACH-001001": 0.1, "ACH-000580": 0.2, "ACH-00001": 0.3,}
            ),
            label="feature1",
            units="cm",
            dataset_label="dataset1",
        )
    ]

    # Mock the breadbox client response
    mock_breadbox_client.get_feature_data = MagicMock(
        return_value=mock_breadbox_response
    )

    # Make a request to get-features for both legacy and breadbox features
    with interactive_db_mock_downloads.app.test_client() as c:
        params = [
            ("features", "breadbox/dataset_id1/feature_id1"),
            (
                "features",
                InteractiveTree.get_id_from_dataset_feature(
                    standard_aliased_dataset_id, standard_aliased_dataset_feature
                ),
            ),
            (
                "groupBy",
                InteractiveTree.get_id_from_dataset_feature(
                    context_dataset_id, context_dataset_feature
                ),
            ),
            ("computeLinearFit", True),
        ]
        response = c.get(
            "/interactive/api/get-features?" + urllib.parse.urlencode(params)
        )
        assert response.status_code == 200
        response_val = json.loads(response.data.decode("utf8"))

        # check that breadbox was called with the correct params
        mock_breadbox_client.get_feature_data.assert_called_with(
            dataset_ids=["dataset_id1"], feature_ids=["feature_id1"],
        )

        actual_depmap_ids = response_val["depmap_ids"]
        assert actual_depmap_ids == ["ACH-000580", "ACH-001001"]

        assert len(response_val["groups"]) == 2
        assert len(response_val["linreg_by_group"]) == 2

        actual_features: list[dict] = response_val["features"]
        assert len(actual_features) == 2
        assert actual_features[0] == {
            "axis_label": "feature1 cm<br>dataset1",
            "feature_id": "breadbox/dataset_id1/feature_id1",
            "label": "feature1",
            "values": [0.2, 0.1],
        }
        assert (
            actual_features[1] is not None
        )  # check that the legacy feature is also present
