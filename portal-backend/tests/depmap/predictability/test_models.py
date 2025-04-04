from json import dumps as json_dumps
from depmap.dataset.models import DependencyDataset
from depmap.predictability.models import (
    PredictiveModel,
    PredictiveFeatureResult,
    PredictiveBackground,
)
from tests.factories import (
    BiomarkerDatasetFactory,
    DependencyDatasetFactory,
    GeneFactory,
    PredictiveFeatureFactory,
    PredictiveModelFactory,
    PredictiveFeatureResultFactory,
    PredictiveBackgroundFactory,
)


def test_get_top_models_features(empty_db_mock_downloads):
    """
    Test that
        Filters for specified dataset and gene
        Returns
            specified number of top models
            specified number of top features for each model
    """
    dataset = DependencyDatasetFactory()
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles
    )
    biomarker_dataset_1 = BiomarkerDatasetFactory()
    gene = GeneFactory()
    gene_2 = GeneFactory()
    gene_no_model = GeneFactory()

    # different genes and datasets
    PredictiveModelFactory(dataset=dataset, entity=gene_2, pearson=20)
    PredictiveModelFactory(dataset=dataset_2, entity=gene, pearson=20)

    # insert uselected one first
    unselected = PredictiveModelFactory(dataset=dataset, entity=gene, pearson=1)
    expected_1 = PredictiveModelFactory(dataset=dataset, entity=gene, pearson=30)
    expected_2 = PredictiveModelFactory(dataset=dataset, entity=gene, pearson=20)

    # insert unselected one first (rank 2)
    PredictiveFeatureResultFactory(
        predictive_model=expected_1,
        feature=PredictiveFeatureFactory(
            feature_id="model_1_feature_2_label",
            feature_name="model_1_feature_2_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        importance=2,
        rank=2,
    )
    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="model_1_feature_0_label",
            feature_name="model_1_feature_0_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=expected_1,
        importance=0,
        rank=0,
    )
    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="model_1_feature_1_label",
            feature_name="model_1_feature_1_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=expected_1,
        importance=1,
        rank=1,
    )

    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="model_2_feature_2_label",
            feature_name="model_2_feature_2_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=expected_2,
        importance=2,
        rank=2,
    )
    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="model_2_feature_0_label",
            feature_name="model_2_feature_0_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=expected_2,
        importance=0,
        rank=0,
    )
    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="model_2_feature_1_label",
            feature_name="model_2_feature_1_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=expected_2,
        importance=1,
        rank=1,
    )

    PredictiveFeatureResultFactory(
        feature=PredictiveFeatureFactory(
            feature_id="unselected_feature_label",
            feature_name="unselected_feature_name",
            dataset_id=biomarker_dataset_1.name.value,
        ),
        predictive_model=unselected,
        importance=0,
        rank=0,
    )

    empty_db_mock_downloads.session.flush()

    assert (
        PredictiveModel.get_top_models_features(
            dataset.dataset_id, gene_no_model.entity_id
        )
        is None
    )

    df = PredictiveModel.get_top_models_features(
        dataset.dataset_id, gene.entity_id, num_models=2, num_top_features=2
    )

    assert len(df) == 4
    assert list(df.columns) == [
        "predictive_model_id",
        "model_label",
        "model_pearson",
        "dataset_enum",
        "feature_name",
        "feature_type",
        "feature_importance",
        "feature_rank",
        "interactive_url",
        "correlation",
        "related_type",
    ]  # these are assumed by consumers

    assert len(df[df["predictive_model_id"] == expected_1.predictive_model_id]) == 2
    assert len(df[df["predictive_model_id"] == expected_2.predictive_model_id]) == 2

    assert df[df["predictive_model_id"] == expected_1.predictive_model_id][
        "feature_name"
    ].tolist() == ["model_1_feature_0_name", "model_1_feature_1_name"]

    assert df[df["predictive_model_id"] == expected_2.predictive_model_id][
        "feature_name"
    ].tolist() == ["model_2_feature_0_name", "model_2_feature_1_name"]


def test_get_background(empty_db_mock_downloads):
    dataset = DependencyDatasetFactory()
    PredictiveBackgroundFactory(dataset=dataset, background=json_dumps([1, 2, 3]))
    empty_db_mock_downloads.session.flush()

    assert PredictiveBackground.get_background(dataset.dataset_id) == [1, 2, 3]
