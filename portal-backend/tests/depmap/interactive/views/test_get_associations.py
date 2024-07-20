import os
import urllib
import json
from flask import current_app
from depmap.dataset.models import DependencyDataset, BiomarkerDataset
from tests.factories import (
    GeneFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    CorrelationFactory,
)
from tests.utilities import interactive_test_utils
from loader.global_search_loader import load_global_search_index


def test_get_associations(empty_db_mock_downloads, tmpdir):
    """
    fixme does not test correctness, pretty much just tests that it works 
    """
    gene_1 = GeneFactory()
    gene_2 = GeneFactory()
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=[gene_1]),
    )
    dataset_2 = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.expression,
        matrix=MatrixFactory(entities=[gene_2]),
    )
    CorrelationFactory(
        dataset_1=dataset_1,
        dataset_2=dataset_2,
        cor_values=[[0.6]],
        filename=str(tmpdir.join("corr")),
    )

    empty_db_mock_downloads.session.flush()
    load_global_search_index()  # the gene lookup uses global search
    interactive_test_utils.reload_interactive_config()  # make interactive config load the datasets we've just created with factories

    params = {"x": "slice/{}/{}/label".format(dataset_1.name.name, gene_1.label)}

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/associations?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert "data" in response
        assert "associatedDatasets" in response

        expected_data = [
            {
                "other_slice_id": "slice/{}/{}/entity_id".format(
                    dataset_2.name.name, gene_2.entity_id
                ),
                "correlation": 0.6,
                "other_dataset": dataset_2.display_name,
                "other_entity_label": gene_2.label,
                "other_entity_type": "gene",
            }
        ]
        expected_checkboxes = [dataset_2.display_name]

        assert response["data"] == expected_data
        assert response["associatedDatasets"] == expected_checkboxes
        assert response["datasetLabel"] == dataset_1.display_name
        assert response["featureLabel"] == gene_1.label


def test_get_breadbox_associations(empty_db_mock_downloads):
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    params = {"x": "breadbox/someDatasetId/someFeatureId"}

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/associations?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        response = json.loads(r.data.decode("utf8"))
        assert "data" in response
        assert "associatedDatasets" in response
