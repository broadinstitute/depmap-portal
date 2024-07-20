from flask import url_for

from depmap.vector_catalog.models import SliceRowType
from tests.factories import NonstandardMatrixFactory
from tests.depmap.utilities.test_endpoint_utils import parse_resp
from tests.utilities import interactive_test_utils
from depmap.settings.settings import TestConfig
from tests.utilities.override_fixture import override

dataset_id = "test-nonstandard-dataset.1"
test_label = "test label"
row_label = "row_label"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            dataset_id: {
                "label": test_label,
                "transpose": False,
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "prepopulate": True,
                "is_categorical": True,
                "categories": "fake mock, never called",
            }
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_categorical_nonstandard_dataset_lookup(empty_db_mock_downloads, app):
    """
    Test for the nonstandard dataset path in the categorical tree
    """

    NonstandardMatrixFactory(
        nonstandard_dataset_id=dataset_id, entities=[row_label], rows_are_entities=False
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        # verify looking up at the root that we get gene and compound as the roots
        r = c.get(
            url_for("vector_catalog.catalog_children", catalog="categorical", id="root")
        )

        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert test_label in set([x["label"] for x in resp["children"]])

    expected_dataset_id = "nonstandard_dataset/{}".format(dataset_id)

    with app.test_client() as c:
        # now, compounds have datasets under them
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="categorical",
                id=expected_dataset_id,
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == row_label
        assert c["terminal"] is True
        expected_row_id = "slice/{}/{}/{}".format(
            dataset_id, row_label, SliceRowType.label.name
        )
        assert c["id"] == expected_row_id
