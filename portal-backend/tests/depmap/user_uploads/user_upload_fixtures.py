from dataclasses import dataclass
import pandas as pd

# user upload
canary_cell_line = "ACH-000425"


@dataclass
class UserUploadFixture:
    cell_line: str = canary_cell_line
    file_name: str = "canary.csv"
    file_path: str = "sample_data/dataset/canary.csv"
    row_name: str = "wing speed"
    expected_row_of_values: pd.Series = pd.Series([10.0], index=[canary_cell_line])
