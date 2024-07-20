import os
import shutil

from flask import current_app
from taigapy import create_taiga_client_v3

from depmap.constellation.utils import (
    SimilarityOption,
    TAIGA_DATASET_VERSION,
    DIR,
    GENE_SETS_FILE,
    CODEP_FILE,
    EXPRESSION_FILE,
    MSIGDB_FILE,
    STRING_EXPERIMENTAL_FILE,
    STRING_TEXT_FILE,
    STRING_COMBINED_FILE,
)
from depmap.taiga_id import utils as taiga_utils


def load_constellation_files():
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    if not os.path.exists(os.path.join(source_dir, DIR)):
        os.makedirs(os.path.join(source_dir, DIR))

    tc = taiga_utils.get_taiga_client()
    gene_sets = tc.get(TAIGA_DATASET_VERSION + "c2.gene.sets")
    gene_sets.to_csv(os.path.join(source_dir, GENE_SETS_FILE), index=False)

    for similarity_option in SimilarityOption:
        df = tc.get(similarity_option.taiga_id)
        df.to_csv(os.path.join(source_dir, similarity_option.file), index=False)


def load_sample_constellation_files():
    assert current_app.config["ENV"] in {"dev", "test", "test-dev"}

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    if not os.path.exists(os.path.join(source_dir, DIR)):
        os.makedirs(os.path.join(source_dir, DIR))

    sample_data_dir = "sample_data"

    shutil.copy(
        os.path.join(sample_data_dir, GENE_SETS_FILE),
        os.path.join(source_dir, GENE_SETS_FILE),
    )

    for similarity_option in SimilarityOption:
        shutil.copy(
            os.path.join(sample_data_dir, similarity_option.file),
            os.path.join(source_dir, similarity_option.file),
        )
