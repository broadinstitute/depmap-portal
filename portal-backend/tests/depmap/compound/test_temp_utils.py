import pytest
from depmap.tile.temp_utils import compound_is_in_oncref_dataset
from types import SimpleNamespace
from depmap.compound.models import drc_compound_datasets


def test_compound_is_in_oncref_dataset_true():
    compound = SimpleNamespace(label="CMPD123")
    data_access = SimpleNamespace(
        get_dataset_feature_labels=lambda auc_id: ["CMPD123", "CMPD999"]
    )
    assert (
        compound_is_in_oncref_dataset(compound, drc_compound_datasets, data_access)
        is True
    )


def test_compound_is_in_oncref_dataset_false():
    compound = SimpleNamespace(label="CMPD123")
    data_access = SimpleNamespace(get_dataset_feature_labels=lambda auc_id: ["CMPD999"])
    assert (
        compound_is_in_oncref_dataset(compound, drc_compound_datasets, data_access)
        is False
    )
