from depmap.compound import new_dose_curves_utils, utils
from depmap.data_access import breadbox_dao
from depmap.enums import DependencyEnum
from depmap.interactive import interactive_utils
from depmap.settings.settings import TestConfig
import pandas as pd
import pytest
from flask import url_for
from json import loads as json_loads

from depmap import data_access
from depmap.dataset.models import DependencyDataset
from depmap.compound.models import (
    Compound,
    DRCCompoundDataset,
    DRCCompoundDatasetWithNamesAndPriority,
    drc_compound_datasets,
)
from depmap.compound.views.index import (
    get_corr_analysis_options_if_available,
    get_drc_options_if_new_tabs_available,
    get_sensitivity_tab_info,
    format_summary_option,
    format_dose_curve_options,
    format_dose_curve,
)
from tests.factories import (
    BiomarkerDatasetFactory,
    CompoundFactory,
    CompoundExperimentFactory,
    DepmapModelFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    DoseResponseCurveFactory,
    CompoundDoseReplicateFactory,
    PredictiveBackgroundFactory,
    PredictiveFeatureFactory,
    PredictiveFeatureResultFactory,
    PredictiveModelFactory,
)
from tests.utilities import interactive_test_utils
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


def test_format_compound_summary(empty_db_mock_downloads):
    """
    Test that
        the logic of the body of the function is okay enough to call format_summary without error
        the label of summary options includes the compound experiment label
    E.g. if first_dep_enum_name was a dataset instead of an enum, format_summary would error
    """
    compound: Compound = CompoundFactory()  # pyright: ignore

    # two compound experiments just so that get_compound_experiment_datasets_with_compound returns a list
    compound_exp_1 = CompoundExperimentFactory(compound=compound)
    compound_exp_2 = CompoundExperimentFactory(compound=compound)

    matrix = MatrixFactory(entities=[compound_exp_1, compound_exp_2])
    dataset = DependencyDatasetFactory(
        matrix=matrix, name=DependencyDataset.DependencyEnum.GDSC1_AUC
    )  # no dose dataset
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    datasets = data_access.get_all_datasets_containing_compound(compound.compound_id)
    summary = get_sensitivity_tab_info(
        compound_entity_id=compound.entity_id, compound_datasets=datasets
    )

    # Even though there are two compound experiments, the dataset should appear once in the result
    expected_option_labels = {dataset.display_name}
    summary_option_labels = {option["label"] for option in summary["summary_options"]}

    assert summary_option_labels == expected_option_labels


def test_format_summary_option(empty_db_mock_downloads):
    dataset = DependencyDatasetFactory(name=DependencyDataset.DependencyEnum.CTRP_AUC)
    compound_exp = CompoundExperimentFactory()
    label = "test_label"

    empty_db_mock_downloads.session.flush()
    expected_keys = {"label", "id", "dataset", "entity"}
    assert format_summary_option(dataset, compound_exp, label).keys() == expected_keys


def test_format_dose_curve_options(empty_db_mock_downloads):
    compound_1 = CompoundFactory()
    compound_exp_1 = CompoundExperimentFactory(compound=compound_1)
    compound_2_no_replicate = CompoundFactory()
    compound_exp_2_no_replicate = CompoundExperimentFactory(
        compound=compound_2_no_replicate
    )

    auc_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[compound_exp_1, compound_exp_2_no_replicate]),
        name=DependencyDataset.DependencyEnum.Repurposing_secondary_AUC,
    )
    dose_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(
            entities=[CompoundDoseReplicateFactory(compound_experiment=compound_exp_1)]
        ),
        name=DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate,
    )
    empty_db_mock_downloads.session.flush()

    compound_experiment_and_datasets_1 = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound_1.entity_id
    )
    dose_curve_options_1 = format_dose_curve_options(compound_experiment_and_datasets_1)
    assert dose_curve_options_1 == [
        {
            "auc_dataset_display_name": auc_dataset.display_name,
            "compound_label": compound_exp_1.label,
            "compound_xref_full": compound_exp_1.xref_full,
            "dataset": auc_dataset.name.name,
            "dose_replicate_dataset": dose_dataset.name.name,
            "dose_replicate_level_yunits": "Viability",
            "entity": compound_exp_1.entity_id,
            "id": "{}_{}".format(auc_dataset.name.name, compound_exp_1.entity_id),
            "label": "{} {}".format(compound_exp_1.label, auc_dataset.display_name),
        }
    ]

    compound_experiment_and_datasets_2 = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound_2_no_replicate.entity_id
    )
    dose_curve_options_2 = format_dose_curve_options(compound_experiment_and_datasets_2)
    assert dose_curve_options_2 == []


def test_format_dose_curve(app, empty_db_mock_downloads):
    """
        Test that the dose response curve endpoint returns as expected
    """
    # define inputs to factories and function calls
    cell_line_name = "CADOES1_BONE"
    xref_type = "CTRP"
    xref = "606135"
    xref_full = xref_type + ":" + xref

    model = DepmapModelFactory(cell_line_name=cell_line_name)
    cpd_exp = CompoundExperimentFactory(xref_type=xref_type, xref=xref, label=xref_full)

    dose_1 = CompoundDoseReplicateFactory(
        compound_experiment=cpd_exp, dose=0.1, replicate=10
    )
    dose_2 = CompoundDoseReplicateFactory(
        compound_experiment=cpd_exp, dose=0.2, replicate=20, is_masked=True
    )

    viability_df = pd.DataFrame(
        {model.cell_line_name: [10, 20]},
        index=["dose_1", "dose_2"]
        # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
    )

    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_dose_replicate,
        matrix=MatrixFactory(
            entities=[dose_1, dose_2],
            cell_lines=[model],
            data=viability_df,
            using_depmap_model_table=True,
        ),
    )
    curve = DoseResponseCurveFactory(compound_exp=cpd_exp, cell_line=model.cell_line)

    empty_db_mock_downloads.session.commit()

    response = format_dose_curve(dataset.name.name, model.model_id, xref_full)

    # test expected curve parameters
    assert response["curve_params"][0]["ec50"] == curve.ec50
    assert response["curve_params"][0]["slope"] == curve.slope
    assert response["curve_params"][0]["upperAsymptote"] == curve.upper_asymptote
    assert response["curve_params"][0]["lowerAsymptote"] == curve.lower_asymptote

    print(response["points"])

    expected_points = [
        {"replicate": 10, "isMasked": None, "viability": 10, "dose": 0.1},
        {"replicate": 20, "isMasked": True, "viability": 20, "dose": 0.2},
    ]

    assert response["points"] == expected_points

    # assert False
    # sort the points we got by combination of dose and replicate (match the order of expected_points so that we can compare the two lists element-wise)
    sorted_points = sorted(
        response["points"], key=lambda k: [k["dose"], k["replicate"]]
    )

    # assert sorted_points == expected_points doesn't work due to some rounding on the floats for the 'viability' field
    # so we're going to have to iterate over all points and compare replicate, masked, dose, and viability manually
    # for i in range(len(sorted_points)):
    #     assert sorted_points[i]['replicate'] == expected_points[i]['replicate']
    # assert sorted_points[i]['isMasked'] == expected_points[i]['isMasked']
    # assert sorted_points[i]['dose'] == expected_points[i]['dose']
    # assert math.isclose(float(sorted_points[i]['viability']), float(expected_points[i]['viability']),
    #                     abs_tol=float(0.00001))
    #
    # assert len(sorted_points) == len(expected_points)


def test_format_dose_curve_multiple_curves(empty_db_mock_downloads):
    """
    Just test that the function runs with multiple dose response curves, and returns two elements
    """
    model = DepmapModelFactory()
    dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(cell_lines=[model], using_depmap_model_table=True)
    )
    compound_experiment = CompoundExperimentFactory()
    # compound_dose_replicate = CompoundDoseReplicateFactory(compound_experiment=compound_experiment)
    DoseResponseCurveFactory(
        cell_line=model.cell_line, compound_exp=compound_experiment
    )
    DoseResponseCurveFactory(
        cell_line=model.cell_line, compound_exp=compound_experiment
    )

    empty_db_mock_downloads.session.flush()

    curve_params = format_dose_curve(
        dataset.name.name,
        model.model_id,
        "{}:{}".format(compound_experiment.xref_type, compound_experiment.xref),
    )["curve_params"]

    assert len(curve_params) == 2


def test_dose_table(empty_db_mock_downloads, app):
    # define inputs to factories and function calls
    cell_line_name = "CADOES1_BONE"
    cell_line_display_name = "CADOES1"
    xref_type = "CTRP"
    xref = "606135"
    xref_full = xref_type + ":" + xref

    model = DepmapModelFactory(
        cell_line_name=cell_line_name, stripped_cell_line_name=cell_line_display_name
    )
    cpd_exp = CompoundExperimentFactory(xref_type=xref_type, xref=xref, label=xref_full)

    dose_1 = CompoundDoseReplicateFactory(
        compound_experiment=cpd_exp, dose=0.00000001, replicate=10
    )
    dose_2 = CompoundDoseReplicateFactory(
        compound_experiment=cpd_exp, dose=0.2, replicate=20, is_masked=True
    )

    viability_df = pd.DataFrame(
        {model.cell_line_name: [10, 20]},
        index=["dose_1", "dose_2"]
        # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
    )
    viability_df2 = pd.DataFrame(
        {model.cell_line_name: [10]},
        index=["dose_1"]
        # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
    )

    dose_replicate_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_dose_replicate,
        matrix=MatrixFactory(
            entities=[dose_1, dose_2],
            cell_lines=[model],
            data=viability_df,
            using_depmap_model_table=True,
        ),
    )

    dose_replicate_dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC2_dose_replicate,
        matrix=MatrixFactory(
            entities=[dose_1],
            cell_lines=[model],
            data=viability_df2,
            using_depmap_model_table=True,
        ),
    )

    auc_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC,
        matrix=MatrixFactory(
            entities=[cpd_exp],
            cell_lines=[model],
            data=pd.DataFrame(
                {model.cell_line_name: [0.5]},
                index=["cpd_exp"]
                # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
            ),
            using_depmap_model_table=True,
        ),
    )
    auc_dataset2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC2_AUC,
        matrix=MatrixFactory(
            entities=[cpd_exp],
            cell_lines=[model],
            data=pd.DataFrame(
                {model.cell_line_name: [0.5]},
                index=["cpd_exp"]
                # I believe this index doesn't do anything? has to do with order that entities=[] is passed in?
            ),
            using_depmap_model_table=True,
        ),
    )
    curve = DoseResponseCurveFactory(compound_exp=cpd_exp, cell_line=model.cell_line)

    empty_db_mock_downloads.session.commit()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "compound.dose_table",
                dataset_name=dose_replicate_dataset.name.name,
                xref_full=xref_full,
            )
        )
        assert r.status_code == 200, r.status_code
        response = json_loads(r.data.decode("utf8"))

        r2 = c.get(
            url_for(
                "compound.dose_table",
                dataset_name=dose_replicate_dataset_2.name.name,
                xref_full=xref_full,
            )
        )
        assert r2.status_code == 200, r2.status_code
        response2 = json_loads(r2.data.decode("utf8"))

        expected = {
            model.model_id: {
                "0-000000010000000": 10,  # 0-000000010000000 is rounded to precision of 2 significant digits on the frontend side of things
                "0-200000000000000": 20,
                "cell_line_display_name": cell_line_display_name,
                "units": 0.5,
            }
        }

        assert response == expected


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


def test_format_dose_curve_and_heatmap_options_new_tab_if_available_true(
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
        result = get_drc_options_if_new_tabs_available(
            compound.label, compound.compound_id
        )

        assert result == [expected_oncref_dataset_w_priority]


def corr_analysis_config(request):
    class TestFeatureFlags:
        def correlation_analysis(self):
            return True

    class TestVersionConfig(TestConfig):
        ENABLED_FEATURES = TestFeatureFlags

    return TestVersionConfig


@override(config=corr_analysis_config)
def test_get_corr_analysis_options_if_available_true(app, monkeypatch):
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

        result = get_corr_analysis_options_if_available(compound_label=compound.label)
        assert len(result) == 6
        matches = [x for x in result if x == expected_oncref_dataset_w_priority]
        assert len(matches) == 1


def config(request):
    class TestFeatureFlags:
        def new_compound_page_tabs(self):
            return True

        def show_all_new_dose_curve_and_heatmap_tab_datasets(self):
            return True

    class TestVersionConfig(TestConfig):
        ENABLED_FEATURES = TestFeatureFlags

    return TestVersionConfig


@override(config=config)
def test_dose_curve_options_all_datasets_available(app, monkeypatch):
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
        result = get_drc_options_if_new_tabs_available(
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


def test_format_dose_curve_options_new_tab_if_available_false(app):
    with app.app_context():
        app.config["ENV_TYPE"] = "public"
        compound = CompoundFactory()
        result = get_drc_options_if_new_tabs_available(
            compound.label, compound.compound_id
        )
        assert result == []


def test_get_corr_analysis_options_if_available_false(app):
    with app.app_context():
        app.config["ENV_TYPE"] = "public"
        compound = CompoundFactory()
        result = get_corr_analysis_options_if_available(compound_label=compound.label)
        assert result == []
