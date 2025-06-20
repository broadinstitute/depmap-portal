from depmap.compound.models import Compound, CompoundDoseReplicate
from tests.factories import (
    CompoundExperimentFactory,
    CompoundDoseReplicateFactory,
    CompoundFactory,
    DoseResponseCurveFactory,
)
import pytest


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


def test_get_dose_response_curves(empty_db_mock_downloads):
    compound = CompoundFactory(compound_id="TEST-0001", label="TestCompound")
    compound_exp = CompoundExperimentFactory(compound=compound, xref_type="BRD")
    drc = DoseResponseCurveFactory(
        compound_exp=compound_exp, drc_dataset_label="Prism_oncology_per_curve"
    )
    empty_db_mock_downloads.session.flush()

    results = Compound.get_dose_response_curves(
        compound_id="TEST-0001", drc_dataset_label="Prism_oncology_per_curve"
    )
    assert len(results) > 0
    assert drc in results
    for curve in results:
        assert curve.drc_dataset_label == "Prism_oncology_per_curve"


def test_get_dose_response_curves_no_matching_compound(empty_db_mock_downloads):
    # Something is very wrong if we are attempting to fetch the dose response curves for a compound that does not exist.
    with pytest.raises(AssertionError):
        Compound.get_dose_response_curves(
            compound_id="NONEXISTENT", drc_dataset_label="Prism_oncology_per_curve"
        )


def test_get_dose_response_curves_no_compound_experiment(empty_db_mock_downloads):
    CompoundFactory(compound_id="TEST-0003", label="TestCompound3")
    empty_db_mock_downloads.session.flush()
    with pytest.raises(AssertionError):
        Compound.get_dose_response_curves(
            compound_id="TEST-0003", drc_dataset_label="Prism_oncology_per_curve"
        )


def test_get_dose_response_curves_experiment_for_different_compound(
    empty_db_mock_downloads,
):
    compound1 = CompoundFactory(compound_id="TEST-0006", label="TestCompound6")
    compound2 = CompoundFactory(compound_id="TEST-0007", label="TestCompound7")
    compound_exp = CompoundExperimentFactory(compound=compound2, xref_type="BRD")
    DoseResponseCurveFactory(
        compound_exp=compound_exp, drc_dataset_label="Prism_oncology_per_curve"
    )
    empty_db_mock_downloads.session.flush()
    with pytest.raises(AssertionError):
        results = Compound.get_dose_response_curves(
            compound_id="TEST-0006", drc_dataset_label="Prism_oncology_per_curve"
        )


def test_get_dose_response_curves_multiple_experiments(empty_db_mock_downloads):
    """
    Compound has multiple CompoundExperiments, each with DoseResponseCurve for the same drc_dataset_label.
    """
    compound = CompoundFactory(compound_id="TEST-0009", label="TestCompound9")
    compound_exp1 = CompoundExperimentFactory(compound=compound, xref_type="BRD")
    compound_exp2 = CompoundExperimentFactory(compound=compound, xref_type="BRD")
    drc1 = DoseResponseCurveFactory(
        compound_exp=compound_exp1, drc_dataset_label="Prism_oncology_per_curve"
    )
    drc2 = DoseResponseCurveFactory(
        compound_exp=compound_exp2, drc_dataset_label="Prism_oncology_per_curve"
    )
    empty_db_mock_downloads.session.flush()
    results = Compound.get_dose_response_curves(
        compound_id="TEST-0009", drc_dataset_label="Prism_oncology_per_curve"
    )
    assert len(results) == 2
    assert drc1 in results and drc2 in results
