from depmap.enums import DataTypeEnum
import pytest
from depmap.settings.settings import TestConfig
from depmap.access_control import PUBLIC_ACCESS_GROUP
from depmap.dataset.models import DependencyDataset, BiomarkerDataset, TabularDataset
from loader import taiga_id_loader, dataset_loader
from tests.factories import MatrixFactory
from tests.utilities.override_fixture import override
from sqlalchemy.sql import text

canonical_taiga_id = "canonical.1/file"
virtual_taiga_id = "virtual.1/file"


def config(request):
    def get_test_versions():
        return {canonical_taiga_id: "test version"}

    class TestVersionConfig(TestConfig):
        GET_DATASET_VERSIONS = get_test_versions

    return TestVersionConfig


def mock_ask_taiga(monkeypatch):
    """
    This needs to be called in the test to use it!
    """

    def mock_ask_taiga_for_canonical_taiga_id(taiga_id: str):
        assert taiga_id == canonical_taiga_id or taiga_id == virtual_taiga_id
        return canonical_taiga_id

    monkeypatch.setattr(
        taiga_id_loader,
        "_ask_taiga_for_canonical_taiga_id",
        mock_ask_taiga_for_canonical_taiga_id,
    )


@pytest.mark.parametrize(
    "dataset_class, dataset_enum, data_type, loader_add_function",
    [
        (
            DependencyDataset,
            DependencyDataset.DependencyEnum.Avana,
            DataTypeEnum.crispr,
            dataset_loader.add_dependency_dataset,
        ),
        (
            BiomarkerDataset,
            BiomarkerDataset.BiomarkerEnum.expression,
            DataTypeEnum.expression,
            dataset_loader.add_biomarker_dataset,
        ),
    ],
)
@override(config=config)
def test_add_dependency_biomarker_dataset(
    empty_db_mock_downloads,
    monkeypatch,
    dataset_class,
    dataset_enum,
    data_type,
    loader_add_function,
):
    """
    test add_dependency_dataset and add_biomarker_dataset
    test that
        adds version to display name
        converts taiga id to canonical
    """
    mock_ask_taiga(monkeypatch)
    matrix = MatrixFactory()
    empty_db_mock_downloads.session.flush()
    loader_add_function(
        dataset_enum,
        "display name",
        "units",
        data_type,
        1,  # priority
        None,  # global priority
        matrix,
        virtual_taiga_id,
        "gene",
        PUBLIC_ACCESS_GROUP,
    )

    # test taiga id is canonical
    assert (
        dataset_class.query.filter_by(name=dataset_enum)
        .with_entities(dataset_class.taiga_id)
        .first()[0]
        == canonical_taiga_id
    )


@override(config=config)
def test_add_tabular_dataset(empty_db_mock_downloads, monkeypatch):
    """
    Test that
        converts to canonical
    """
    mock_ask_taiga(monkeypatch)
    dataset_loader.add_tabular_dataset(
        TabularDataset.TabularEnum.mutation, virtual_taiga_id
    )
    assert (
        TabularDataset.query.filter_by(name=TabularDataset.TabularEnum.mutation)
        .with_entities(TabularDataset.taiga_id)
        .first()[0]
        == canonical_taiga_id
    )
