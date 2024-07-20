import pytest

from depmap.antibody.models import Antibody
from depmap.compound.models import Compound, CompoundDoseReplicate, CompoundExperiment
from depmap.gene.models import Gene
from depmap.proteomics.models import Protein
from depmap.utilities.entity_utils import (
    get_entity_class_by_name,
    get_matching_entity_ids_for_label,
)
from depmap.utilities.exception import InvalidEntityTypeError
from tests.factories import (
    CompoundFactory,
    CompoundExperimentFactory,
    CompoundDoseReplicateFactory,
    ProteinFactory,
)


def test_get_entity_class_by_type():
    assert get_entity_class_by_name("gene") == Gene
    assert get_entity_class_by_name("antibody") == Antibody
    assert get_entity_class_by_name("compound_experiment") == CompoundExperiment
    assert get_entity_class_by_name("compound_dose_replicate") == CompoundDoseReplicate

    with pytest.raises(InvalidEntityTypeError):
        get_entity_class_by_name("invalid")
        get_entity_class_by_name("entity")


def test_get_matching_entity_ids_for_label(empty_db_mock_downloads):
    compound = CompoundFactory()
    compound_experiment_1 = CompoundExperimentFactory(compound=compound)
    compound_experiment_2 = CompoundExperimentFactory(compound=compound)

    cpd_dose_rep_1 = CompoundDoseReplicateFactory(
        compound_experiment=compound_experiment_1
    )
    cpd_dose_rep_2 = CompoundDoseReplicateFactory(
        compound_experiment=compound_experiment_2
    )

    assert get_matching_entity_ids_for_label(Compound, compound.label) == [
        compound.entity_id
    ]

    matching_compound_experiment_ids = get_matching_entity_ids_for_label(
        CompoundExperiment, compound.label
    )
    assert len(matching_compound_experiment_ids) == 2
    assert set(matching_compound_experiment_ids) == {
        compound_experiment_1.entity_id,
        compound_experiment_2.entity_id,
    }

    matching_compound_dose_replicate_ids = get_matching_entity_ids_for_label(
        CompoundDoseReplicate, compound.label
    )
    assert len(matching_compound_dose_replicate_ids) == 2
    assert set(matching_compound_dose_replicate_ids) == {
        cpd_dose_rep_1.entity_id,
        cpd_dose_rep_2.entity_id,
    }


# On the Custom Downloads page, the user can filter on gene symbols. If they try to download
# a Proteomics dataset, we want get_matching_entity_ids_for_label to be able to use a protein's GENE
# label to get the matching PROTEIN entity_id
def test_get_matching_protein_entity_ids_for_label(empty_db_mock_downloads):
    protein = ProteinFactory()
    assert get_matching_entity_ids_for_label(Protein, protein.gene.label) == [
        protein.entity_id
    ]
