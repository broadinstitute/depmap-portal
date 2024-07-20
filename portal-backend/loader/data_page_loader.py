import os
import pandas as pd
from flask import current_app


def load_data_page_summary(webapp_data_dir, df: pd.DataFrame):
    source_dir = webapp_data_dir
    dest_path = os.path.join(source_dir, "data_page_summary", "all_data_avail.csv")
    parent_dir = os.path.dirname(dest_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
    df.to_csv(dest_path, index=False)


def load_data_page(filename):
    df = pd.read_csv(filename)
    assert isinstance(current_app.config, dict)
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    dest_path = os.path.join(source_dir, "data_page_summary", "all_data_avail.csv")
    parent_dir = os.path.dirname(dest_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
    df.to_csv(dest_path, index=False)
