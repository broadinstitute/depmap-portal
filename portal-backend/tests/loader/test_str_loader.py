"""Tests str_profile_loader."""

import os
import pandas as pd

from depmap.cell_line.models import STRProfile
from loader import str_profile_loader
from tests.factories import CellLineFactory


def test_load_str_profiles(empty_db_mock_downloads):
    """
    Test STR profile loader
        uses the sample data csv, which contains two entries
    Test that
        able to load depmap ids in both format ACH-XXXXXX and ACH-XXXXXX-01
    """
    loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
    test_csv = os.path.join(loader_data_dir, "str_profile/sample_str_profile.csv")

    # verify that the test csv is set up to test both types of depmap ids ACH-XXXXXX and ACH-XXXXXX-01
    test_df = pd.read_csv(test_csv)
    assert set([len(x) for x in test_df["Reg ID"]]) == {10, 13}

    cell_line_1 = CellLineFactory(
        depmap_id="ACH-000425"
    )  # Hardcoded to match depmap_id in test_csv
    cell_line_2 = CellLineFactory(depmap_id="ACH-000304")
    empty_db_mock_downloads.session.flush()
    str_profile_loader.load_str_profiles(test_csv)

    all_profiles = STRProfile.get_all()
    assert len(all_profiles) == 2
    profile_1 = [x for x in all_profiles if x.depmap_id == cell_line_1.depmap_id][0]
    profile_2 = [x for x in all_profiles if x.depmap_id == cell_line_2.depmap_id][0]

    profile_1_dict = profile_1.to_dict()
    # Also hardcoded to match test_csv
    expected_profile_1_dict = {
        "str_profile_id": 1,
        "penta_e": "5, 14",
        "vwa": "16, 17",
        "depmap_id": "ACH-000425",
        "d5s818": "10, 12",
        "d8s1179": "10, 13",
        "d13s317": "12",
        "tpox": "8, 11",
        "notation": "STR matches public reference profile",
        "d7s820": "8, 11",
        "fga": "23",
        "d3s1358": "15",
        "d16s539": "9, 12",
        "amel": "X",
        "th01": "6, 9",
        "csf1po": "10, 11",
        "mouse": "NA",
        "d21s11": "28, 31",
        "penta_d": "11, 12",
        "d18s51": "15",
    }
    assert profile_1_dict == expected_profile_1_dict

    # just a sanity check for profile 2
    assert (
        profile_2.notation
        == "Matches reference profile and same as WM-115 and WM-266-4; samples from the same patient"
    )
