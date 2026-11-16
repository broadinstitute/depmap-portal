import json

import pandas as pd

from conftest import load_script

script = load_script(
    "analysis-pipeline/predictability/scripts/create_daintree_config_norm_table.py"
)


def _write_norms(path, models, R=10, seed=0, min_pairs=10):
    path.write_text(
        json.dumps({"R": R, "seed": seed, "min_pairs": min_pairs, "models": models})
    )
    return str(path)


def test_create_norm_table_one_row_per_model(tmp_path):
    f1 = _write_norms(
        tmp_path / "n1.json",
        {"RNASeq": dict(norm=0.5, n_samples=10, n_features=100, n_targets=1)},
    )
    f2 = _write_norms(
        tmp_path / "n2.json",
        {
            "DNA": dict(norm=0.25, n_samples=20, n_features=200, n_targets=2),
            "Lineage": dict(norm=0.125, n_samples=30, n_features=300, n_targets=3),
        },
        R=5,
    )
    artifacts = [
        dict(model_name="A", screen_name="crispr", feature_imp_norm_filename=f1),
        dict(model_name="B", screen_name="rnai", feature_imp_norm_filename=f2),
    ]
    artifacts_file = tmp_path / "artifacts.json"
    artifacts_file.write_text(json.dumps(artifacts))
    out = tmp_path / "out.csv"

    script.create_norm_table(str(artifacts_file), str(out))

    expected = pd.DataFrame(
        [
            ("A", "crispr", "RNASeq", 0.5, 10, 100, 1, 10, 0, 10),
            ("B", "rnai", "DNA", 0.25, 20, 200, 2, 5, 0, 10),
            ("B", "rnai", "Lineage", 0.125, 30, 300, 3, 5, 0, 10),
        ],
        columns=[
            "model_name",
            "screen_name",
            "feature_set",
            "norm",
            "n_samples",
            "n_features",
            "n_targets",
            "R",
            "seed",
            "min_pairs",
        ],
    )
    pd.testing.assert_frame_equal(
        pd.read_csv(out), expected, check_like=True
    )  # ignore column order
