import os
import pandas as pd
from loader.tda_loader import _format_tda_summary
from loader import gene_loader
from depmap.tda.views import get_expected_columns_in_tda_table

# TODO: Need to change the sample data
def test_format_tda_summary(empty_db_mock_downloads):
    loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
    gene_loader.load_hgnc_genes(
        os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
    )
    gene_loader.load_hgnc_genes(
        os.path.join(loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv")
    )
    empty_db_mock_downloads.session.commit()

    tda_summary_raw_data = pd.read_csv(
        "sample_data/tda/sample_tda_table.csv", dtype={"entrez_id": int}
    )
    df = _format_tda_summary(tda_summary_raw_data)

    assert get_expected_columns_in_tda_table().issubset(df.columns)
