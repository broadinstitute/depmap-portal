from unittest.mock import MagicMock
import pytest
from io import StringIO
import pandas as pd
import json
from csv import DictReader
from flask import url_for
from depmap.dataset.models import DependencyDataset
from depmap.download.tasks import export_dataset
import depmap.download.tasks as tasks  # imported to monkeypatch
from tests.factories import (
    GeneFactory,
    MatrixFactory,
    CellLineFactory,
    DependencyDatasetFactory,
)
from tests.utilities import interactive_test_utils
from unittest.mock import MagicMock

# todo: add test for adding cell line metadata
@pytest.mark.parametrize("drop_nas", [True, False])
def test_export_dataset(
    app, empty_db_mock_downloads, celery_app, monkeypatch, drop_nas
):
    # celery_app is a test celery fixture that comes from celery, see https://docs.celeryproject.org/en/stable/userguide/testing.html#celery-app-celery-app-used-for-testing)
    # replace the task function with one bound to the celery_app, bypassing redis
    foo = celery_app.task(bind=True)(export_dataset)
    monkeypatch.setattr(tasks, "export_dataset", foo)
    monkeypatch.setattr(tasks, "_progress_callback", MagicMock())

    genes = [GeneFactory(label="gene_" + str(i)) for i in range(10)]
    query_gene_labels = [genes[i * 2].label for i in range(3)]
    gene_not_in_datasets = GeneFactory(label="not here")
    query_gene_labels.append(gene_not_in_datasets.label)

    cell_lines = [CellLineFactory(depmap_id="cell_line_" + str(i)) for i in range(10)]
    query_cell_line_ids = [cell_lines[i * 2].depmap_id for i in range(3)]
    cell_not_in_datasets = CellLineFactory(
        depmap_id="this cell line isn't in the dataset"
    )
    query_cell_line_ids.append(cell_not_in_datasets.depmap_id)

    num_cols = len(cell_lines)
    num_rows = len(genes)

    df = pd.DataFrame()
    for i in range(num_cols):
        df[i] = [j + i / 10 for j in range(num_rows)]

    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=genes, cell_lines=cell_lines, data=df.values),
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        r = c.post(
            url_for("api.download_export_dataset"),
            data=json.dumps(
                {
                    "datasetId": dataset.name.name,
                    "featureLabels": query_gene_labels,
                    "cellLineIds": query_cell_line_ids,
                    "dropEmpty": drop_nas,
                }
            ),
            content_type="application/json",
        )

        assert r.status_code == 200, r.status_code
        response = json.loads(r.data.decode("utf8"))
        assert response["state"] == "SUCCESS"
        download_url = response["result"]["downloadUrl"]

        # hit the download url and verify that the csv there is as expected
        download_response = c.get(download_url)
        assert download_response.status_code == 200

        csv = pd.read_csv(
            StringIO(download_response.data.decode("utf-8")), index_col=0, header=0
        )
        if drop_nas:
            assert csv.shape[0] == len(query_cell_line_ids) - 1
            assert csv.shape[1] == len(query_gene_labels) - 1
        else:
            assert csv.shape[0] == len(query_cell_line_ids)
            assert csv.shape[1] == len(query_gene_labels)


def test_bulk_files_csv_with_taiga(app, empty_db_mock_downloads):
    with app.test_client() as c:
        response = c.get(url_for("api.download_bulk_files_csv"))
        assert response.status_code == 200, response.status_code
        sin = StringIO(response.data.decode("utf8"))
        r = DictReader(sin)
        rows = list(r)
        assert set(rows[0].keys()) == {
            "filename",
            "release",
            "release_date",
            "url",
            "taiga_id",
            "md5_hash",
        }
