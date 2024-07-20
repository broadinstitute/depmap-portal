import urllib
import pandas as pd
from io import StringIO
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
        filename=str(tmpdir.join("cors.sqlite3")),
        cor_values=[[0.5]],
    )

    empty_db_mock_downloads.session.flush()
    load_global_search_index()  # the gene lookup uses global search
    interactive_test_utils.reload_interactive_config()

    params = {"x": "slice/{}/{}/label".format(dataset_1.name.name, gene_1.label)}

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get("/interactive/api/associations-csv?" + urllib.parse.urlencode(params))
        assert r.status_code == 200
        df = pd.read_csv(StringIO(r.data.decode("utf-8")))

        # if we got dfs_equal_ignoring_column_order working, we could test equality of below instead of the individual statements
        assert len(df) == 1
        assert len(df.columns) == 4  # should drop other_slice_id
        assert df["Gene/Compound"][0] == gene_2.label
        assert df["Dataset"][0] == dataset_2.display_name
        assert df["Correlation"][0] == 0.5
