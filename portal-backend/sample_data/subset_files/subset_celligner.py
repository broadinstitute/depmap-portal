import os
import sys

import pandas as pd
from taigapy import create_taiga_client_v3

depmap_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
sys.path.append(depmap_root)

from depmap.celligner.utils import (
    ALIGNMENT_FILE,
    DIR,
    DISTANCES_FILE_FOR_DOWNLOAD,
    SUBTYPES_FILE,
)
from depmap.settings.settings import Config
from sample_data.subset_files.subsets import cell_lines, cell_lines_arxspan

if __name__ == "__main__":
    cell_line_names = [c.split("_")[0] for c in cell_lines]
    c = pd.DataFrame(
        {
            "sampleID": cell_lines_arxspan,
            "display_name": cell_line_names,
            "model_loaded": True,
        }
    )

    tc = create_taiga_client_v3()

    a = tc.get(Config.CELLIGNER_ALIGNMENT_TAIGA_ID)
    a_sub = a.groupby(["type", "subtype"]).head(5)
    a_sub = a_sub.merge(c, how="left", on="sampleID")
    a_sub["display_name"] = a_sub["display_name"].fillna(a_sub["sampleID"])
    a_sub["model_loaded"] = a_sub.model_loaded.fillna(False)
    a_sub.to_csv(os.path.join("sample_data", DIR, ALIGNMENT_FILE), index=False)

    d = tc.get(Config.CELLIGNER_DISTANCES_TAIGA_ID)
    d_sub = d.filter(a_sub.sampleID, axis=0).filter(a_sub.sampleID, axis=1)
    d_sub.to_csv(os.path.join("sample_data", DIR, DISTANCES_FILE_FOR_DOWNLOAD))

    subtypes = tc.get(Config.CELLIGNER_SUBTYPES_TAIGA_ID)
    subtypes.to_csv(os.path.join("sample_data", DIR, SUBTYPES_FILE), index=False)
