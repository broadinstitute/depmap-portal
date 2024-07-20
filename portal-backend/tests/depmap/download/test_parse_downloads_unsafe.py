from depmap.taiga_id.models import TaigaAlias
from loader import taiga_id_loader
from tests.conftest import TestConfig
from pytest import fixture
from depmap.settings.parse_downloads import parse_downloads_unsafe
from loader.taiga_id_loader import load_in_memory_taiga_ids

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
    size: 1 MB
    pipeline_name: ""
    url:
      bucket: depmap-dmc-downloads
      file_name: test/gene_effect.csv
    description: "description"
    taiga_id: "sample.2/taiga_id"
"""

# override the downloads path so that we read a single yaml file
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
        DOWNLOADS_PATH = downloads_path

    return TestVersionConfig


def test_parse_downloads_unsafe(_empty_db_base, tmpdir):
    # before we can test parse_downloads_unsafe we need to make sure that the TaigaAliases are properly loaded
    load_in_memory_taiga_ids()

    # make sure we can parse the index file and get the releases and the aux info we want to pull out
    info = parse_downloads_unsafe()

    assert len(info.releases) == 1
    assert len(info.releases[0].all_files) == 1
    assert info.display_names_by_taiga_ids == {"sample.2/taiga_id": "Gene Effect 19Q3"}
    assert info.release_by_filename == {"sample.yaml": info.releases[0]}

    # make sure we cache the file and re-read it when the index.yaml's timestamp changes. We'll tack on
    # some data onto the sample.yaml so we can detect whether it has reloaded the file or not.

    sample_yaml_path = str(tmpdir.join("sample.yaml"))
    with open(sample_yaml_path, "at") as fd:
        fd.write(
            """  - name: file2.csv
    type: genetic_dependency
    size: 1 MB
    pipeline_name: ""
    description: "description"
    taiga_id: "sample.3/taiga_id"
"""
        )

    # now re-read the file and see if the 2nd file is there. It shouldn't be if caching is working
    info = parse_downloads_unsafe()
    assert len(info.releases[0].all_files) == 1

    # now update the index.yaml and make sure that we can re-read the file
    tmpdir.join("index.yaml").write(
        """downloads:
  - sample
  # updated
"""
    )
    info = parse_downloads_unsafe()
    assert len(info.releases[0].all_files) == 2
