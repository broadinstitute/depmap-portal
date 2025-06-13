from typing import List
from depmap.dataset.models import DependencyDataset
import pytest
import pandas as pd
from depmap.compound import new_dose_curves_utils
from tests.factories import (
    CompoundDoseReplicateFactory,
    CompoundExperimentFactory,
    CompoundFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    DoseResponseCurveFactory,
    MatrixFactory,
)


def _setup_dose_response_curves(models: List[DepmapModelFactory], compound_exps: list):
    dose_rep_entities = []
    for cpd_exp in compound_exps:
        dose_1 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp, dose=0.1, replicate=10
        )
        dose_rep_entities.append(dose_1)
        dose_2 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp, dose=0.2, replicate=20, is_masked=True,
        )
        dose_rep_entities.append(dose_2)
        dose_3 = CompoundDoseReplicateFactory(
            compound_experiment=cpd_exp, dose=0.3, replicate=30
        )
        dose_rep_entities.append(dose_3)

    viability_df = pd.DataFrame(
        {model.cell_line_name: [10, 20, 30] for model in models},
        index=["dose_1", "dose_2", "dose_3"],
    )

    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate,
        matrix=MatrixFactory(
            entities=dose_rep_entities,
            cell_lines=models,
            data=viability_df,
            using_depmap_model_table=True,
        ),
    )

    for compound_exp in compound_exps:
        curves = [
            DoseResponseCurveFactory(
                compound_exp=compound_exp,
                cell_line=model.cell_line,
                drc_dataset_label="Prism_oncology_per_curve",
            )
            for model in models
        ]


def test_get_dose_response_curves_per_model(empty_db_mock_downloads):
    drc_dataset_label = "Prism_oncology_per_curve"
    replicate_dataset_name = "Prism_oncology_dose_replicate"

    xref_type = "BRD"
    xref = "PRC-12345"
    xref_full = xref_type + ":" + xref
    compound = CompoundFactory(compound_id="DPC-12345")
    cpd_exp = CompoundExperimentFactory(
        xref_type=xref_type, xref=xref, label=xref_full, compound=compound
    )
    models = [DepmapModelFactory(), DepmapModelFactory(), DepmapModelFactory()]

    _setup_dose_response_curves(models=models, compound_exps=[cpd_exp])
    empty_db_mock_downloads.session.flush()

    result = new_dose_curves_utils.get_dose_response_curves_per_model(
        compound_id=str(compound.compound_id),
        drc_dataset_label=drc_dataset_label,
        replicate_dataset_name=replicate_dataset_name,
    )
    assert isinstance(result, dict)
    assert "curve_params" in result
    assert "dose_replicate_points" in result

    assert isinstance(result["curve_params"], list)
    assert len(result["curve_params"]) == len(models)  # One per model/cell line
    for curve in result["curve_params"]:
        assert "id" in curve
        assert "displayName" in curve
        assert "ec50" in curve
        assert "slope" in curve
        assert "lowerAsymptote" in curve
        assert "upperAsymptote" in curve

    assert isinstance(result["dose_replicate_points"], dict)
    assert set(result["dose_replicate_points"].keys()) == set(
        [m.model_id for m in models]
    )
    for reps in result["dose_replicate_points"].values():
        assert isinstance(reps, list)
        # Should be 3 replicates per model (from _setup_dose_response_curves)
        assert len(reps) == 3
        for rep in reps:
            assert "id" in rep
            assert "dose" in rep
            assert "viability" in rep
            assert "isMasked" in rep
            assert "replicate" in rep

    expected_curve_params = [
        {
            "id": "ACH-0",
            "displayName": "0",
            "ec50": 0.0,
            "slope": 0.0,
            "lowerAsymptote": 0.0,
            "upperAsymptote": 0.0,
        },
        {
            "id": "ACH-1",
            "displayName": "1",
            "ec50": 0.0,
            "slope": 0.0,
            "lowerAsymptote": 0.0,
            "upperAsymptote": 0.0,
        },
        {
            "id": "ACH-2",
            "displayName": "2",
            "ec50": 0.0,
            "slope": 0.0,
            "lowerAsymptote": 0.0,
            "upperAsymptote": 0.0,
        },
    ]
    assert sorted(result["curve_params"], key=lambda x: x["id"]) == sorted(
        expected_curve_params, key=lambda x: x["id"]
    )

    expected_dose_replicate_points = {
        "ACH-0": [
            {
                "id": "ACH-0",
                "dose": 0.1,
                "viability": 10,
                "isMasked": None,
                "replicate": 10,
            },
            {
                "id": "ACH-0",
                "dose": 0.2,
                "viability": 20,
                "isMasked": True,
                "replicate": 20,
            },
            {
                "id": "ACH-0",
                "dose": 0.3,
                "viability": 30,
                "isMasked": None,
                "replicate": 30,
            },
        ],
        "ACH-1": [
            {
                "id": "ACH-1",
                "dose": 0.1,
                "viability": 10,
                "isMasked": None,
                "replicate": 10,
            },
            {
                "id": "ACH-1",
                "dose": 0.2,
                "viability": 20,
                "isMasked": True,
                "replicate": 20,
            },
            {
                "id": "ACH-1",
                "dose": 0.3,
                "viability": 30,
                "isMasked": None,
                "replicate": 30,
            },
        ],
        "ACH-2": [
            {
                "id": "ACH-2",
                "dose": 0.1,
                "viability": 10,
                "isMasked": None,
                "replicate": 10,
            },
            {
                "id": "ACH-2",
                "dose": 0.2,
                "viability": 20,
                "isMasked": True,
                "replicate": 20,
            },
            {
                "id": "ACH-2",
                "dose": 0.3,
                "viability": 30,
                "isMasked": None,
                "replicate": 30,
            },
        ],
    }
    for key, expected_list in expected_dose_replicate_points.items():
        assert sorted(
            result["dose_replicate_points"][key],
            key=lambda x: (x["dose"], x["replicate"]),
        ) == sorted(expected_list, key=lambda x: (x["dose"], x["replicate"]))


def test_get_dose_replicate_points_skips_nan():
    class DummyRep:
        def __init__(self, dose, is_masked, replicate):
            self.dose = dose
            self.is_masked = is_masked
            self.replicate = replicate

    class DummyVal(float):
        def item(self):
            return float(self)

    viabilities = [DummyVal(float("nan")), DummyVal(float("nan")), DummyVal(5.0)]
    replicates = [DummyRep(1, False, 1), DummyRep(2, True, 2), DummyRep(3, False, 3)]
    points = new_dose_curves_utils.get_dose_replicate_points(
        viabilities, replicates, "MODEL"
    )
    assert len(points) == 1
    assert points[0]["dose"] == 3
    assert points[0]["viability"] == 5.0


def test_get_dose_replicate_points_all_invalid():
    class DummyRep:
        def __init__(self, dose, is_masked, replicate):
            self.dose = dose
            self.is_masked = is_masked
            self.replicate = replicate

    class DummyVal(float):
        def item(self):
            return float(self)

    # All viabilities are NaN
    viabilities = [DummyVal(float("nan")), DummyVal(float("nan"))]
    replicates = [DummyRep(1, False, 1), DummyRep(2, True, 2)]
    points = new_dose_curves_utils.get_dose_replicate_points(
        viabilities, replicates, "MODEL"
    )
    assert points == []
