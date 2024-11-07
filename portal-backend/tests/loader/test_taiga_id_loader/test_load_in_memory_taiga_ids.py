from depmap.taiga_id.models import TaigaAlias
from loader import taiga_id_loader
from tests.conftest import TestConfig
from pytest import fixture

release_yaml = """virtual_dataset_id: "test-load-in-memory-taiga-ids.1"
name: TEST DATA
release_date: 2018-05-08
type: other_crispr
description: This dataset contains long text description
citation: This is a fake dev citation
terms: depmap
files:
  - name: gene_effect.csv
    display_label: Gene Effect 19Q3
    type: genetic_dependency
    size: MB
    pipeline_name: ""
    url:
      bucket: depmap-dmc-downloads
      file_name: test/gene_effect.csv
    is_main_file: false
    description: "description"
    taiga_id: "small-chronos-combined-e82b.2/chronos_combined_score"
    sources:
      - broad
"""


@fixture
def config(tmpdir):
    downloads_path = str(tmpdir)
    tmpdir.join("index.yaml").write(
        """downloads:
  - sample
"""
    )
    tmpdir.join("sample.yaml").write(release_yaml)

    class TestVersionConfig(TestConfig):
        DOWNLOADS_PATHS = [downloads_path]

    return TestVersionConfig


def test_load_in_memory_taiga_ids(_empty_db_base):
    """
    Test that

    Using _empty_db_base because it does not yet call load_in_memory_taiga_ids (empty_db_mock_downloads does)
    """
    download_test_taiga_ids = [  # as defined in test setting
        "small-avana-f2b9.2/avana_score",
        "test-taiga-id.1",
    ]

    assert len(TaigaAlias.query.all()) == 0

    taiga_id_loader.load_in_memory_taiga_ids()

    assert len(TaigaAlias.query.all()) == 3
    assert {x.taiga_id for x in TaigaAlias.query.all()} == set(
        download_test_taiga_ids
        + ["small-chronos-combined-e82b.2/chronos_combined_score"]
    )
