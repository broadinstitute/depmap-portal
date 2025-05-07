from loader.depmap_model_loader import load_depmap_model_metadata
import pandas as pd


def dfs_equal_ignoring_column_order(df1, df2):
    columns = list(df1.columns)
    print(columns)
    print(df1[columns])
    print(df2[columns])

    return (
        len(df1.columns) == len(df2.columns)
        and set(df1.columns) == set(df2.columns)
        and df1[columns].equals(df2[columns])
    )


def test_dfs_equal_ignoring_column_order():
    # same dfs, different column order
    df_1 = pd.DataFrame(
        {"a": [1, 2], "b": [10, 20]}, index=["one", "two"], columns=["a", "b"]
    )
    df_2 = pd.DataFrame(
        {"a": [1, 2], "b": [10, 20]}, index=["one", "two"], columns=["b", "a"]
    )

    assert list(df_1.columns) != list(df_2.columns)
    assert dfs_equal_ignoring_column_order(df_1, df_2)

    # different row order should be false
    df_3 = pd.DataFrame(
        {"a": [2, 1], "b": [20, 10]}, index=["two", "one"], columns=["a", "b"]
    )
    assert list(df_1.columns) == list(df_3.columns)
    assert not dfs_equal_ignoring_column_order(df_1, df_3)


def load_sample_cell_lines():
    from flask import current_app
    import os
    from depmap.database import db
    from depmap.cell_line.models import CellLine

    loader_data_dir = current_app.config["LOADER_DATA_DIR"]

    # DepMapModels have a fk to CellLine and are enforced to be 1:1. This means
    # that we need to populate some CellLine records in order for load_depmap_model_metadata to
    # be called. We'll do this manually without filling out all values to keep things simple
    # this is just for setting up data for testes
    csv_path = os.path.join(loader_data_dir, "cell_line/models_metadata.csv")

    models = pd.read_csv(csv_path)

    for rec in models.to_records():
        cell_line = CellLine(
            cell_line_display_name=rec["CellLineName"], depmap_id=rec["ModelID"],
        )

        db.session.add(cell_line)

    load_depmap_model_metadata(csv_path,)
