# -*- coding: utf-8 -*-
"""Defines fixtures available to all tests."""

import os
import re
import shutil
from collections import defaultdict
from unittest.mock import MagicMock
from dataclasses import asdict

from breadbox_facade import BBClient

from depmap.access_control import PUBLIC_ACCESS_GROUP
from depmap.access_control.sql_rewrite import (
    create_filtered_views,
    replace_filtered_views,
)
from depmap.app import (
    create_app,
    enable_access_controls,
    get_table_mapping_for_access_controls,
)

from depmap.data_explorer_2.utils import clear_cache
from depmap.database import db as _db
from depmap.database import transaction
from depmap.dataset.models import BiomarkerDataset, DependencyDataset, TabularDataset
from depmap.enums import DependencyEnum
from depmap.interactive.config.models import InteractiveConfig
from depmap.settings.settings import TestConfig
from depmap.settings.shared import DATASET_METADATA
from depmap.utilities import hdf5_utils
from loader import (
    cell_line_loader,
    celligner_loader,
    compound_loader,
    dataset_loader,
    depmap_model_loader,
    gene_loader,
    matrix_loader,
    nonstandard_loader,
    taiga_id_loader,
    transcription_start_site_loader,
    context_explorer_loader,
    compound_dashboard_loader,
    data_page_loader,
)
from tests.depmap.interactive.fixtures import (
    custom_cell_line_group_depmap_ids,
    custom_cell_line_group_feature,
)
from tests.depmap.user_uploads.user_upload_fixtures import UserUploadFixture
from tests.factories import CustomCellLineGroupFactory, TabularDatasetFactory
from tests.private_dataset_fixtures import *  # this makes these fixtures available to use. fixme better organization
from tests.utilities.df_test_utils import load_sample_cell_lines
from tests.utilities.override_fixture import overridable_fixture


@overridable_fixture
def config(request):
    """

    overridable_fixtures need to take in request as a parameter
    """
    return TestConfig


@pytest.fixture(scope="function")
def app(tmpdir, config, monkeypatch):
    """
    An application for the tests
    Set tempfiles here so that they are different for every test
    Adds overrides to whatever config is passed in
    """
    db_path = str(tmpdir.join("test.db"))

    # Override accessor method for getting the default crispr enum
    from depmap import enums

    class TestConfigWithOverrides(config):
        DB_PATH = db_path
        WEBAPP_DATA_DIR = str(tmpdir.mkdir("test_data"))
        NONSTANDARD_DATA_DIR = str(tmpdir.mkdir("test_nonstandard_data"))
        COMPUTE_RESULTS_ROOT = str(tmpdir.mkdir("test_results"))
        SQLALCHEMY_DATABASE_URI = "sqlite:///{0}".format(db_path)
        SECRET_KEY = "secret-key-test"

    _app = create_app(TestConfigWithOverrides)
    ctx = _app.test_request_context()
    ctx.push()

    yield _app

    ctx.pop()

    # clear the data explorer 2 cache, which uses functools instead of flask
    clear_cache()


@pytest.fixture(scope="function")
def mock_cansar_client(app, monkeypatch):
    from depmap.cansar import extension

    class MockCansarClient:
        def __init__(self, client_id, client_secret):
            self.client_id = client_id
            self.client_secret = client_secret

        def get_protein(self, uniprot_id):
            return None

    monkeypatch.setattr(extension, "CansarClient", MockCansarClient)


@pytest.fixture(scope="function")
def mock_breadbox_client(monkeypatch):
    from depmap import extensions

    class MockBreadboxFacadeClient:
        def __init__(self):
            self.client = MagicMock()

    class MockBreadboxExtension:
        def __init__(self):
            self.app = MagicMock()
            self.client = MockBreadboxFacadeClient()

    mock_extension = MockBreadboxExtension()
    monkeypatch.setattr(extensions, "breadbox", mock_extension)
    return mock_extension.client


@pytest.fixture(scope="function")
def mock_taiga_client(app, monkeypatch, tmpdir):
    import taigapy

    user_upload_fixture = UserUploadFixture()

    class MockTaigaClientV3:
        def __init__(self, cache_dir, api=None):
            self.cache_dir = cache_dir
            self.api = api

        def download_to_cache(self, datafile_id, requested_format):
            shutil.copy(user_upload_fixture.file_path, tmpdir)
            return os.path.join(tmpdir, user_upload_fixture.file_name)

        def get_dataset_metadata(self, taiga_dataset_id: str, version: str = None):
            if taiga_dataset_id == "invalid_taiga_id":
                return None

            assert "." not in taiga_dataset_id
            return {
                "dataset": {"name": "dataset"},
                "datasetVersion": {
                    "version": int(version) if version else 1,
                    "name": version if version else "1",
                    "state": "approved",
                    "datafiles": [{"name": taiga_dataset_id, "type": "HDF5"}],
                },
            }

    monkeypatch.setattr(taigapy, "create_taiga_client_v3", MockTaigaClientV3)


@overridable_fixture
def mock_ask_taiga_for_canonical_taiga_id(request, app, monkeypatch):
    from loader import taiga_id_loader

    monkeypatch.setattr(
        taiga_id_loader, "_ask_taiga_for_canonical_taiga_id", lambda taiga_id: taiga_id
    )


class InteractiveConfigFakeMutationsDownload(InteractiveConfig):
    def __format_all_private_dataset_settings(self):
        return {
            "private-b4d7094196889fa4614409570bb12ab5c09c9cc00388deb7c13ec57fd2996461": None
        }

    def is_legacy_private_dataset(self, dataset_id: str) -> bool:
        return False

    @classmethod
    def _get_mutations_taiga_id(cls):
        return "this-is-test-nonsense-that-should-never-be-checked-against.1/except-for-taiga-alias-loading"


class DefaultDictMock(defaultdict):
    def __contains__(self, item):
        """
        So that `x in dict` will always return true
        """
        return True


def drop_views(app):
    with app.app_context():
        c = _db.session.connection()
        replace_filtered_views(c, get_table_mapping_for_access_controls())


@pytest.fixture(scope="function")
def _empty_db_base(app, mock_ask_taiga_for_canonical_taiga_id):
    """
    mock_ask_taiga_for_canonical_taiga_id is so that we don't actually create taiga client (which fails on travis)

    The empty_db_mock_downloads fixture should in most cases be used instead of this.
    This just creates a db.
    Usually you want the downloads mocked as well (empty_db_mock_downloads). At least, it doesn't hurt to, and let's assume so by default.

    Most tests that use this fixture could be better re-written to instead override the mock_ask_taiga_for_canonical_taiga_id fixture
        But as things stand, in these cases, we still want mock_ask_taiga_for_canonical_taiga_id so that furture calls to e.g. load_in_memory_taiga_ids has the mock
    """
    _db.app = app
    with app.app_context():
        _db.create_all()
        c = _db.session.connection()
        create_filtered_views(c, get_table_mapping_for_access_controls())
        enable_access_controls()
        c.close()

    yield _db

    # Explicitly close DB connection
    _db.session.expire_all()
    _db.session.close()

    # This is necessary for tests to run
    drop_views(app)
    _db.drop_all()


@pytest.fixture(scope="function")
def _empty_db_taiga_aliases_loaded(_empty_db_base):
    # this has to be here. if it's within the app context, the objects don't get loaded
    # the commit is also needed. otherwise, downstream fixtures like populated_db, clear this when they initiation their transation
    taiga_id_loader.load_in_memory_taiga_ids()
    _empty_db_base.session.commit()

    yield _empty_db_base


@pytest.fixture(scope="function")
def empty_db_mock_downloads(_empty_db_taiga_aliases_loaded):
    """
    This should be
    """
    _empty_db_taiga_aliases_loaded.app._depmap_interactive_config = (
        InteractiveConfigFakeMutationsDownload()
    )

    yield _empty_db_taiga_aliases_loaded


@pytest.fixture(scope="function")
def empty_db_with_genes(_empty_db_taiga_aliases_loaded):
    with transaction():
        loader_data_dir = current_app.config["LOADER_DATA_DIR"]

        gene_loader.load_hgnc_genes(
            os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
        )
        gene_loader.load_hgnc_genes(
            os.path.join(
                loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv"
            )
        )


@pytest.fixture(scope="function")
def empty_db_with_mutation_biomarker_dataset(_empty_db_taiga_aliases_loaded):
    """
    Which means that InteractiveConfig is lazily instantiated, and will include any datasets loaded by the tets into the db
    """
    # add a factory-generated tabular dataset entry for mutation, because this is used to find the mutation (color) download_url when initializing interactive config
    # this uses a factory-generated thing because things that use this fixture tend to also use factories, meaning that they will realize that gene_1 has already been used
    TabularDatasetFactory(name=TabularDataset.TabularEnum.mutation)
    _empty_db_taiga_aliases_loaded.session.commit()

    yield _empty_db_taiga_aliases_loaded


@pytest.fixture(scope="function")
def empty_db_with_celligner(_empty_db_taiga_aliases_loaded):
    loader_data_dir = current_app.config["LOADER_DATA_DIR"]

    cell_line_loader.load_cell_lines_metadata(
        os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
    )

    celligner_loader.load_celligner_sample_data()

    yield _empty_db_taiga_aliases_loaded


@pytest.fixture(scope="function")
def empty_db_with_constellation(_empty_db_taiga_aliases_loaded):
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    constellation_dir = os.path.join(source_dir, "constellation")

    os.makedirs(constellation_dir)

    shutil.copy(
        "sample_data/constellation/gene_sets.csv",
        os.path.join(constellation_dir, "gene_sets.csv"),
    )
    shutil.copy(
        "sample_data/constellation/msigdb.csv",
        os.path.join(constellation_dir, "msigdb.csv"),
    )
    shutil.copy(
        "sample_data/constellation/codep.csv",
        os.path.join(constellation_dir, "codep.csv"),
    )

    yield _empty_db_taiga_aliases_loaded


@pytest.fixture(scope="function")
def interactive_db_mock_downloads(_empty_db_taiga_aliases_loaded):
    with transaction(_empty_db_taiga_aliases_loaded):
        load_interactive_db_data()
    _empty_db_taiga_aliases_loaded.app._depmap_interactive_config = (
        InteractiveConfigFakeMutationsDownload()
    )
    taiga_id_loader.load_interactive_canonical_taiga_ids()
    yield _empty_db_taiga_aliases_loaded


@pytest.fixture(scope="function")
def populated_db(empty_db_mock_downloads):
    """A database for the tests."""
    with transaction(empty_db_mock_downloads):
        load_populated_db_data()
    empty_db_mock_downloads.app._depmap_interactive_config = (
        InteractiveConfigFakeMutationsDownload()
    )
    taiga_id_loader.load_interactive_canonical_taiga_ids()  # not sure that this does anything/is needed
    yield empty_db_mock_downloads


@pytest.fixture(scope="function")
def test_matrix(empty_db_mock_downloads):
    """
    Load just one matrix, from matrix testing purposes
    """

    with transaction(empty_db_mock_downloads):
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        gene_loader.load_hgnc_genes(
            os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
        )
        load_sample_cell_lines()

        cell_line_loader.load_contexts(
            os.path.join(loader_data_dir, "cell_line/contexts.csv")
        )

        test_matrix_abs_file_path = os.path.join(
            empty_db_mock_downloads.app.config["PROJECT_ROOT"],
            "tests/depmap/partials/test_matrix.hdf5",
        )
        test_matrix = matrix_loader.create_matrix_object(
            "test", test_matrix_abs_file_path, "test units", PUBLIC_ACCESS_GROUP
        )
        _db.session.add(test_matrix)

    yield empty_db_mock_downloads


def load_interactive_db_data():
    """
    Loads genes, mutations, contexts, cell lines, avana, expression and CN
    Expression and CN are explicitly referred to in InteractiveConfig, and required for its import
    :return:
    """
    with transaction():
        loader_data_dir = current_app.config["LOADER_DATA_DIR"]

        gene_loader.load_hgnc_genes(
            os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
        )
        gene_loader.load_hgnc_genes(
            os.path.join(
                loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv"
            )
        )
        load_sample_cell_lines()
        cell_line_loader.load_contexts(
            os.path.join(loader_data_dir, "cell_line/contexts.csv")
        )
        dataset_loader.load_mutations(
            os.path.join(loader_data_dir, "dataset/mutations.csv"), "test-taiga-id.1"
        )
        avana_metadata = {
            "taiga_id": "small-avana-f2b9.2/avana_score",
            "matrix_file_name_root": "dataset/avana",
        }
        avana_metadata.update(
            asdict(DATASET_METADATA[DependencyDataset.DependencyEnum.Avana])
        )
        dataset_loader.load_single_input_file_dependency_dataset(
            DependencyDataset.DependencyEnum.Avana, avana_metadata, PUBLIC_ACCESS_GROUP,
        )

        biomarker_datasets = {
            BiomarkerDataset.BiomarkerEnum.rppa: {"taiga_id": "test-taiga-id.1",},
            BiomarkerDataset.BiomarkerEnum.mutations_prioritized: {
                "taiga_id": "test-taiga-id.1",
            },
        }

        for biomarker_enum, biomarker_dataset_metadata in biomarker_datasets.items():
            biomarker_dataset_metadata.update(asdict(DATASET_METADATA[biomarker_enum]))
            file_path = os.path.join(
                current_app.config["LOADER_DATA_DIR"],
                "dataset",
                biomarker_enum.name + ".hdf5",
            )
            dataset_loader.load_biomarker_dataset(
                biomarker_enum,
                biomarker_dataset_metadata,
                file_path,
                PUBLIC_ACCESS_GROUP,
            )

        from depmap.settings.settings import id_to_sample_dir_path

        for taiga_id in current_app.config["GET_NONSTANDARD_DATASETS"]():
            entity_file_path = os.path.join(
                current_app.config["LOADER_DATA_DIR"], id_to_sample_dir_path[taiga_id]
            )
            nonstandard_loader.add_nonstandard_matrix(
                taiga_id, entity_file_path, PUBLIC_ACCESS_GROUP
            )

        CustomCellLineGroupFactory(
            uuid=custom_cell_line_group_feature,
            depmap_ids=custom_cell_line_group_depmap_ids,
        )


def load_populated_db_data():
    with transaction():
        loader_data_dir = current_app.config["LOADER_DATA_DIR"]

        # standalone models first
        gene_loader.load_hgnc_genes(
            os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
        )
        gene_loader.load_hgnc_genes(
            os.path.join(
                loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv"
            )
        )

        compound_loader.load_compounds("sample_data/compound/compounds.csv")

        # csv should contain metadata for
        cell_line_loader.load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
        depmap_model_loader.load_depmap_model_metadata(
            os.path.join(loader_data_dir, "cell_line/models_metadata.csv")
        )

        cell_line_loader.load_contexts(
            os.path.join(loader_data_dir, "cell_line/contexts.csv")
        )

        dataset_loader.load_translocations(
            os.path.join(loader_data_dir, "dataset/translocations.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_fusions(
            os.path.join(loader_data_dir, "dataset/fusions.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_mutations(
            os.path.join(loader_data_dir, "dataset/mutations.csv"),
            "placeholder-taiga-id.1",
        )
        transcription_start_site_loader.load_transcription_start_sites(
            os.path.join(loader_data_dir, "transcription_start_site/rrbs_tss_info.csv")
        )

        gene_loader.load_gene_score_confidence_coeffs(
            os.path.join(loader_data_dir, "gene", "gene_confidence_coeffs.csv",)
        )

        gene_loader.load_achilles_lfc_cell_file(
            os.path.join(loader_data_dir, "dataset", "achilles_lfc_cell.hdf5",)
        )

        datasets = {
            DependencyDataset.DependencyEnum.GDSC1_AUC: {
                "matrix_file_name_root": "dataset/gdsc1-auc",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.GDSC1_IC50: {
                "matrix_file_name_root": "dataset/gdsc1-auc",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.GDSC2_AUC: {
                "matrix_file_name_root": "dataset/gdsc2-auc",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.GDSC2_IC50: {
                "matrix_file_name_root": "dataset/gdsc2-auc",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.Prism_oncology_AUC: {
                "matrix_file_name_root": "dataset/prism-oncology-auc",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.Prism_oncology_IC50: {
                "matrix_file_name_root": "dataset/prism-oncology-ic50",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.Avana: {
                "matrix_file_name_root": "dataset/avana",
                "taiga_id": "small-avana-f2b9.2/avana_score",  # includes dataset name for testing
            },
            DependencyDataset.DependencyEnum.Chronos_Combined: {  # Default crispr
                "matrix_file_name_root": "dataset/chronos_combined",
                "taiga_id": "small-chronos-combined-e82b.2/chronos_combined_score",
            },
            DependencyDataset.DependencyEnum.GeCKO: {
                "matrix_file_name_root": "dataset/gecko",
                "taiga_id": "small-gecko-aff0.1",
            },
            DependencyDataset.DependencyEnum.RNAi_Ach: {
                "matrix_file_name_root": "dataset/rnai_ach",
                "taiga_id": "small-rnai-d0ad.1",
            },
            DependencyDataset.DependencyEnum.RNAi_Nov_DEM: {
                "matrix_file_name_root": "dataset/rnai_nov_dem",
                "taiga_id": "small-rnai-d0ad.1",
            },
            DependencyDataset.DependencyEnum.RNAi_merged: {  # Default rnai
                "matrix_file_name_root": "dataset/rnai-merged",
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.Rep_all_single_pt: {  # Default drug screen
                "matrix_file_name_root": "dataset/rep-all-single-pt",
                "taiga_id": "placeholder-taiga-id.1",
            },
        }

        for dep_enum, dataset in datasets.items():
            # add units and display_name from what we're using for real
            real_dataset_def = asdict(DATASET_METADATA[dep_enum])
            dataset.update(real_dataset_def)
            dataset_loader.load_single_input_file_dependency_dataset(
                dep_enum, dataset, PUBLIC_ACCESS_GROUP
            )

        gene_loader.load_gene_executive_info(
            os.path.join(loader_data_dir, "gene/dep_summary.csv"),
            os.path.join(loader_data_dir, "gene/dropped_by_chronos.csv"),
        )

        context_explorer_data_avail = pd.read_csv(
            "sample_data/context_explorer/sample_data_avail.csv"
        )
        context_explorer_loader.load_context_explorer_summary(
            current_app.config["WEBAPP_DATA_DIR"], context_explorer_data_avail
        )
        context_explorer_loader.load_context_explorer_context_analysis(
            os.path.join(loader_data_dir, "context_explorer", "context_analysis.csv")
        )

        data_page_all_data_avail = pd.read_csv(
            "sample_data/data_page/sample_all_data_avail.csv"
        )
        data_page_loader.load_data_page_summary(
            current_app.config["WEBAPP_DATA_DIR"], data_page_all_data_avail
        )

        compound_summary_primary_csv = pd.read_csv(
            "sample_data/compound_dashboard/compound_summary_primary.csv"
        )

        compound_dashboard_loader.load_compound_summary(
            DependencyEnum.Rep_all_single_pt, compound_summary_primary_csv
        )

        compound_summary_oncref_csv = pd.read_csv(
            "sample_data/compound_dashboard/compound_summary_oncref.csv"
        )

        compound_dashboard_loader.load_compound_summary(
            DependencyEnum.Prism_oncology_AUC, compound_summary_oncref_csv
        )

        biomarker_datasets = {
            BiomarkerDataset.BiomarkerEnum.expression: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.copy_number_absolute: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.copy_number_relative: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.mutation_pearson: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.mutations_hotspot: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.mutations_damaging: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.mutations_driver: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.rppa: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.rrbs: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.proteomics: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.sanger_proteomics: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.metabolomics: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.ssgsea: {
                "taiga_id": "placeholder-taiga-id.1",
                "transpose": True,
            },
            BiomarkerDataset.BiomarkerEnum.fusions: {
                "taiga_id": "placeholder-taiga-id.1",
                "transpose": True,
            },
            BiomarkerDataset.BiomarkerEnum.crispr_confounders: {
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.context: {
                "taiga_id": "placeholder-taiga-id.1",
                "transpose": True,
            },
        }
        for biomarker_enum, biomarker_matrix in biomarker_datasets.items():
            real_dataset_def = asdict(DATASET_METADATA[biomarker_enum])
            biomarker_matrix.update(real_dataset_def)
            file_path = os.path.join(
                current_app.config["LOADER_DATA_DIR"],
                "dataset",
                biomarker_enum.name + ".hdf5",
            )
            dataset_loader.load_biomarker_dataset(
                biomarker_enum, biomarker_matrix, file_path, PUBLIC_ACCESS_GROUP
            )


@pytest.fixture(scope="session")
def celery_config():
    return {"task_always_eager": True}


@pytest.fixture(scope="function")
def mock_celery_task_update_state(monkeypatch):
    # Mock task.update_status because it requires Redis
    import depmap.user_uploads.tasks

    def mock_update_state(*args, **kwargs):
        pass

    monkeypatch.setattr(depmap.user_uploads.tasks, "update_state", mock_update_state)
