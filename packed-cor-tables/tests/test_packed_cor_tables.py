import pandas as pd
from packed_cor_tables import write_cor_df, read_cor_for_given_id, InputMatrixDesc


def test_write_df(tmpdir):
    df = pd.DataFrame(
        {
            "dim_0": [0, 0, 1, 1],
            "dim_1": [1, 2, 3, 0],
            "cor": [0.1, 0.2, 0.001, 0.9],
            "log10qvalue": [1e-10, 1e-1, 0.1, 1e-12],
        }
    )
    out = str(tmpdir.join("out.sqlite3"))
    write_cor_df(
        df,
        InputMatrixDesc(
            given_ids=["C1", "C2", "C3", "C4"], taiga_id="crispr-taiga", name="crispr"
        ),
        InputMatrixDesc(
            given_ids=["E1", "E2", "E3", "E4"], taiga_id="expr-taiga", name="expr"
        ),
        out,
    )

    df = read_cor_for_given_id(out, "C1").sort_values("feature_given_id_1")

    def round_list(l):
        return [float(f"{x:.4}") for x in l]

    assert list(df["feature_given_id_1"]) == ["E2", "E3"]
    assert round_list(df["cor"]) == [0.1, 0.2]

    df = read_cor_for_given_id(out, "C2").sort_values("feature_given_id_1")
    assert list(df["feature_given_id_1"]) == ["E1", "E4"]
    assert round_list(df["cor"]) == [0.9, 0.001]
