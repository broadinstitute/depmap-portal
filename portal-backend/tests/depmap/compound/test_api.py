from flask import url_for
from tests.factories import (
    CompoundDoseReplicateFactory,
    CompoundExperimentFactory,
    CompoundFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    DoseResponseCurveFactory,
    MatrixFactory,
)
from depmap.dataset.models import DependencyDataset


def _setup_dose_curve_data(db, compound_id, model_id, ec50):
    compound = CompoundFactory(compound_id=compound_id)
    cpd_exp = CompoundExperimentFactory(
        xref_type="BRD", xref="PRC-00001", label="BRD:PRC-00001", compound=compound
    )
    model = DepmapModelFactory(model_id=model_id, stripped_cell_line_name="TestLine")

    dose_rep = CompoundDoseReplicateFactory(
        compound_experiment=cpd_exp, dose=1.0, replicate=1
    )
    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate,
        matrix=MatrixFactory(
            entities=[dose_rep],
            cell_lines=[model],
            data=__import__("pandas").DataFrame(
                {model.cell_line_name: [50.0]}, index=["dose_1"]
            ),
            using_depmap_model_table=True,
        ),
    )
    DoseResponseCurveFactory(
        compound_exp=cpd_exp,
        cell_line=model.cell_line,
        drc_dataset_label="Prism_oncology_per_curve",
        ec50=ec50,
        slope=1.0,
        upper_asymptote=1.0,
        lower_asymptote=0.0,
    )
    db.session.flush()
    return compound


def test_dose_curve_data_normal(empty_db_mock_downloads):
    compound = _setup_dose_curve_data(
        empty_db_mock_downloads, compound_id="DPC-00001", model_id="ACH-001", ec50=0.5,
    )

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(
            url_for(
                "api.compound_dose_curve_data",
                compound_id=str(compound.compound_id),
                drc_dataset_label="Prism_oncology_per_curve",
                replicate_dataset_name="Prism_oncology_dose_replicate",
            )
        )
        assert r.status_code == 200
        data = r.get_json()
        assert data is not None
        assert "curve_params" in data
        assert len(data["curve_params"]) == 1
        assert data["curve_params"][0]["ec50"] == 0.5


def test_dose_curve_data_infinity_ec50_excluded(empty_db_mock_downloads):
    compound = _setup_dose_curve_data(
        empty_db_mock_downloads,
        compound_id="DPC-00002",
        model_id="ACH-002",
        ec50=float("inf"),
    )

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(
            url_for(
                "api.compound_dose_curve_data",
                compound_id=str(compound.compound_id),
                drc_dataset_label="Prism_oncology_per_curve",
                replicate_dataset_name="Prism_oncology_dose_replicate",
            )
        )
        assert r.status_code == 200
        data = r.get_json()
        assert data is not None
        assert "curve_params" in data
        assert len(data["curve_params"]) == 0
