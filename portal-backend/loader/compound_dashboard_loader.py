import os

import pandas as pd
from flask import current_app
from typing import List, Tuple
from depmap.compound_dashboard.views import get_compound_summary_csv_path
from depmap.enums import DependencyEnum


def load_compound_summary(name: DependencyEnum, df: pd.DataFrame):
    dest_path = get_compound_summary_csv_path(name)
    parent_dir = os.path.dirname(dest_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
    df.to_csv(dest_path, index=False)
