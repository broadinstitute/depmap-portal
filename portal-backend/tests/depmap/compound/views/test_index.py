from depmap.compound import new_dose_curves_utils
from depmap.data_access import breadbox_dao
from depmap.interactive import interactive_utils
from depmap.settings.settings import TestConfig
import pytest
from flask import url_for

from depmap import data_access
from depmap.dataset.models import DependencyDataset
from depmap.compound.models import (
    Compound,
    DRCCompoundDatasetWithNamesAndPriority,
    drc_compound_datasets,
)
from depmap.compound.views.index import (
    get_corr_analysis_options,
    get_heatmap_dose_curves_tab_drc_options,
)
from tests.factories import (
    BiomarkerDatasetFactory,
    CompoundFactory,
    CompoundExperimentFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    PredictiveBackgroundFactory,
    PredictiveFeatureFactory,
    PredictiveFeatureResultFactory,
    PredictiveModelFactory,
)
from tests.utilities.override_fixture import override

expected_oncref_dataset_w_priority = DRCCompoundDatasetWithNamesAndPriority(
    drc_dataset_label="Prism_oncology_per_curve",
    viability_dataset_given_id="Prism_oncology_viability",
    replicate_dataset="Prism_oncology_dose_replicate",
    auc_dataset_given_id="Prism_oncology_AUC_collapsed",
    display_name="PRISM OncRef Lum",
    auc_dataset_priority=1,
    auc_dataset_display_name="PRISM OncRef",
    viability_dataset_display_name="PRISM OncRef",
    log_auc_dataset_given_id="PRISMOncologyReferenceLog2AUCMatrix",
)


def test_render_view_compound(populated_db, monkeypatch):
    with populated_db.app.test_client() as c:

        def mock_valid_row(a, b):
            return True

        def mock_has_config(dataset_id):
            return False

        def mock_is_breadbox_id(dataset_id):
            return True

        def mock_get_compound_dose_replicates(
            compound_id, drc_dataset_label, replicate_dataset_name
        ):
            return ["mock_replicate_1"]

        def mock_get_dataset_label(dataset):
            return "PRISM OncRef"

        def mock_get_dataset_priority(dataset):
            return 1

        monkeypatch.setattr(breadbox_dao, "valid_row", mock_valid_row)
        monkeypatch.setattr(breadbox_dao, "is_breadbox_id", mock_is_breadbox_id)
        monkeypatch.setattr(interactive_utils, "has_config", mock_has_config)
        monkeypatch.setattr(
            new_dose_curves_utils,
            "get_compound_dose_replicates",
            mock_get_compound_dose_replicates,
        )
        monkeypatch.setattr(data_access, "get_dataset_label", mock_get_dataset_label)
        monkeypatch.setattr(
            data_access, "get_dataset_priority", mock_get_dataset_priority
        )

        for compound in Compound.query.all():
            r = c.get(url_for("compound.view_compound", name=compound.label))
            assert r.status_code == 200, "{} with response code {}".format(
                compound.label, r.status_code
            )


def test_get_predictive_table(app, empty_db_mock_downloads):
    compound1 = CompoundFactory(label="Compound 1")
    compound2 = CompoundFactory(label="Compound 2")
    compound_experiment1 = CompoundExperimentFactory(compound=compound1)
    compound_experiment2 = CompoundExperimentFactory(compound=compound2)
    non_existing_compound = CompoundFactory(label="fake")

    rep_all_single_pt_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Rep_all_single_pt,
        matrix=MatrixFactory(entities=[compound_experiment1]),
        priority=2,
    )

    onc_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_AUC,
        matrix=MatrixFactory(entities=[compound_experiment1]),
        priority=1,
    )
    rep1m_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Rep1M,
        matrix=MatrixFactory(entities=[compound_experiment1]),
    )

    rep_all_single_pt_dataset_model = PredictiveModelFactory(
        dataset=rep_all_single_pt_dataset,
        entity=compound_experiment1,
        pearson=10,
        label="Core_omics",
    )
    onc_dataset_model = PredictiveModelFactory(
        dataset=onc_dataset, entity=compound_experiment1, pearson=9, label="Core_omics",
    )
    rep1m_dataset_model = PredictiveModelFactory(
        dataset=rep1m_dataset,
        entity=compound_experiment1,
        pearson=8,
        label="Core_omics",
    )

    predictive_feature = PredictiveFeatureFactory(
        dataset_id=BiomarkerDatasetFactory().name.value
    )

    PredictiveFeatureResultFactory(
        predictive_model=rep_all_single_pt_dataset_model,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )
    PredictiveFeatureResultFactory(
        predictive_model=onc_dataset_model,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )
    PredictiveFeatureResultFactory(
        predictive_model=rep1m_dataset_model,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )

    PredictiveBackgroundFactory(dataset=rep_all_single_pt_dataset)
    PredictiveBackgroundFactory(dataset=onc_dataset)
    PredictiveBackgroundFactory(dataset=rep1m_dataset)

    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        # Data exists for compound 1
        r_predictability_table = c.get(
            url_for("compound.get_predictive_table", compoundLabel=compound1.label,)
        )
        r_predictability_table_json = r_predictability_table.get_json()

        assert r_predictability_table.status_code == 200
        assert len(r_predictability_table_json) != 0

        expected_first_screen = "Prism_oncology_AUC display name"
        expected_second_screen = "Rep_all_single_pt display name"
        expected_third_screen = "Rep1M display name"
        assert r_predictability_table_json[0]["screen"] == expected_first_screen
        assert r_predictability_table_json[1]["screen"] == expected_second_screen
        assert r_predictability_table_json[2]["screen"] == expected_third_screen

        # No data exists for compound 2
        r_no_predictability_table = c.get(
            url_for(
                "compound.get_predictive_table",
                compoundLabel=non_existing_compound.label,
            )
        )
        r_no_predictability_table_json = r_no_predictability_table.get_json()
        assert r_no_predictability_table.status_code == 200
        assert len(r_no_predictability_table_json) == 0


def test_format_dose_curve_and_heatmap_options_new_tab(
    app, monkeypatch, empty_db_mock_downloads
):
    with app.app_context():
        # mock methods on data_access
        def mock_dataset_exists(auc_dataset_given_id):
            return auc_dataset_given_id in [
                "Prism_oncology_viability",
                "PRISMOncologyReferenceLog2AUCMatrix",
                "Prism_oncology_AUC_collapsed",
                "Prism_oncology_dose_replicate",
            ]

        def mock_valid_row(auc_dataset_given_id, compound_label):
            return True

        def mock_get_dataset_priority(dataset_given_id):
            return 1

        def mock_get_dataset_label(dataset):
            return "PRISM OncRef"

        monkeypatch.setattr(data_access, "dataset_exists", mock_dataset_exists)
        monkeypatch.setattr(data_access, "valid_row", mock_valid_row)
        monkeypatch.setattr(data_access, "get_dataset_label", mock_get_dataset_label)
        monkeypatch.setattr(
            data_access, "get_dataset_priority", mock_get_dataset_priority
        )

        # mock methods on new_dose_curves_utils
        def mock_get_compound_dose_replicates(
            compound_id, drc_dataset_label, replicate_dataset_name
        ):
            return ["x"]

        monkeypatch.setattr(
            new_dose_curves_utils,
            "get_compound_dose_replicates",
            mock_get_compound_dose_replicates,
        )

        monkeypatch.setattr(data_access, "get_dataset_label", mock_get_dataset_label)
        monkeypatch.setattr(
            data_access, "get_dataset_priority", mock_get_dataset_priority
        )

        compound = CompoundFactory()
        dose_curves_and_heatmap_result = get_heatmap_dose_curves_tab_drc_options(
            compound.label, compound.compound_id
        )

        assert dose_curves_and_heatmap_result == [expected_oncref_dataset_w_priority]


# Whether or not to showCorrelationAnalysis is a check that has been moved to the frontend in CompoundPage.tsx
def test_get_corr_analysis_options(app, monkeypatch):
    with app.app_context():

        def mock_valid_row(a, b):
            return True

        def mock_has_config(dataset_id):
            return False

        def mock_is_breadbox_id(dataset_id):
            return True

        def mock_get_dataset_priority(dataset):
            return 1

        def mock_get_dataset_label(dataset):
            return "PRISM OncRef"

        monkeypatch.setattr(breadbox_dao, "valid_row", mock_valid_row)
        monkeypatch.setattr(breadbox_dao, "is_breadbox_id", mock_is_breadbox_id)
        monkeypatch.setattr(interactive_utils, "has_config", mock_has_config)
        monkeypatch.setattr(data_access, "get_dataset_label", mock_get_dataset_label)
        monkeypatch.setattr(
            data_access, "get_dataset_priority", mock_get_dataset_priority
        )

        compound = CompoundFactory()

        result = get_corr_analysis_options(compound_label=compound.label)
        assert len(result) == 6
        matches = [x for x in result if x == expected_oncref_dataset_w_priority]
        assert len(matches) == 1


def test_dose_curve_options_all_datasets(app, monkeypatch):
    with app.app_context():

        def mock_valid_row(a, b):
            return True

        def mock_has_config(dataset_id):
            return False

        def mock_is_breadbox_id(dataset_id):
            return True

        def mock_get_compound_dose_replicates(
            compound_id, drc_dataset_label, replicate_dataset_name
        ):
            return ["mock_replicate_1"]

        def mock_get_dataset_label(dataset):
            return "dataset_label"

        def mock_get_dataset_priority(dataset):
            return 1

        monkeypatch.setattr(breadbox_dao, "valid_row", mock_valid_row)
        monkeypatch.setattr(breadbox_dao, "is_breadbox_id", mock_is_breadbox_id)
        monkeypatch.setattr(interactive_utils, "has_config", mock_has_config)
        monkeypatch.setattr(
            new_dose_curves_utils,
            "get_compound_dose_replicates",
            mock_get_compound_dose_replicates,
        )
        monkeypatch.setattr(data_access, "get_dataset_label", mock_get_dataset_label)
        monkeypatch.setattr(
            data_access, "get_dataset_priority", mock_get_dataset_priority
        )

        compound = CompoundFactory()
        result = get_heatmap_dose_curves_tab_drc_options(
            compound.label, compound.compound_id
        )
        assert isinstance(result, list)
        assert result == [
            DRCCompoundDatasetWithNamesAndPriority(
                drc_dataset_label=dataset.drc_dataset_label,
                viability_dataset_given_id=dataset.viability_dataset_given_id,
                replicate_dataset=dataset.replicate_dataset,
                auc_dataset_given_id=dataset.auc_dataset_given_id,
                display_name=dataset.display_name,
                auc_dataset_priority=1,
                auc_dataset_display_name="dataset_label",
                viability_dataset_display_name="dataset_label",
                log_auc_dataset_given_id=dataset.log_auc_dataset_given_id,
            )
            for dataset in drc_compound_datasets
        ]
