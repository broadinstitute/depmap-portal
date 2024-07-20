from depmap.compound.models import CompoundDoseReplicate
from tests.factories import CompoundExperimentFactory, CompoundDoseReplicateFactory


def test_compound_dose_replicate_format_label(empty_db_mock_downloads):
    """
    Test CompoundDoseReplicate.format_label(...) and dose_replicate_object.format_label_without_experiment
    That they have the same suffix
    """

    dose = 1
    replicate = 1
    is_masked = True

    compound_exp = CompoundExperimentFactory(label="exp_label")
    compound_dose_replicate = CompoundDoseReplicateFactory(
        compound_experiment=compound_exp,
        dose=dose,
        replicate=replicate,
        is_masked=is_masked,
    )
    empty_db_mock_downloads.session.flush()

    full_label = CompoundDoseReplicate.format_label(
        compound_exp.label, dose, replicate, is_masked
    )
    dose_replicate_masked_only = compound_dose_replicate.label_without_compound_name

    assert full_label.endswith(dose_replicate_masked_only)

    assert full_label == "exp_label 1μM rep1 masked"
    assert dose_replicate_masked_only == "1μM rep1 masked"
