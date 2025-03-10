import pytest

from depmap.antibody.models import Antibody
from depmap.compound.models import CompoundDoseReplicate, CompoundExperiment
from depmap.gene.models import Gene
from depmap.utilities.entity_utils import (
    get_entity_class_by_name,
)
from depmap.utilities.exception import InvalidEntityTypeError



def test_get_entity_class_by_type():
    assert get_entity_class_by_name("gene") == Gene
    assert get_entity_class_by_name("antibody") == Antibody
    assert get_entity_class_by_name("compound_experiment") == CompoundExperiment
    assert get_entity_class_by_name("compound_dose_replicate") == CompoundDoseReplicate

    with pytest.raises(InvalidEntityTypeError):
        get_entity_class_by_name("invalid")
        get_entity_class_by_name("entity")

