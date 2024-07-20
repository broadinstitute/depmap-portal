import os
import sys
import pandas as pd
from taigapy import create_taiga_client_v3

depmap_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
sys.path.append(depmap_root)
from depmap.settings.settings import Config
from sample_data.subset_files.subsets import cell_lines

if __name__ == "__main__":
    SAMPLE_DIR = Config.SAMPLE_DATA_DIR
    DIR = os.path.join(SAMPLE_DIR, "metmap")

    tc = create_taiga_client_v3()
    metmap_df = tc.get(Config.METMAP_500_TAIGA_ID)
    # Filter by cell lines in sample subset
    sample_metmap = metmap_df[metmap_df["cell_line"].isin(cell_lines)]
    sample_metmap.to_csv(
        os.path.join(DIR, "metmap500.csv"),
        index=False,
        columns=[
            "cell_line",
            "CI.05",
            "CI.95",
            "mean",
            "penetrance",
            "tissue",
            "depmap_id",
        ],
    )
