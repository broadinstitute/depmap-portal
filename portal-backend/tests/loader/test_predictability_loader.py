import pytest

from depmap.enums import DependencyEnum
from depmap.dataset.models import DependencyDataset, BiomarkerDataset
from depmap.gene.models import Gene
from depmap.predictability.models import PredictiveModel


from loader.predictability_loader import load_predictive_model_csv

from tests.factories import BiomarkerDatasetFactory


def test_load_predictive_model_csv(populated_db):
    sox10 = Gene.get_gene_by_entrez(entrez_id=6663)
    assert sox10 is not None
    dataset_given_id = "Chronos_Combined"

    # manually add rppa because this is the only test that relies on it existing
    BiomarkerDatasetFactory(name=BiomarkerDataset.BiomarkerEnum.rppa)
    populated_db.session.flush()

    load_predictive_model_csv(
        "sample_data/predictability/predictive_models_Chronos_Combined.csv",
        "Chronos_Combined",
        "sample_data/predictability/predictive_models_feature_metadata_Chronos_Combined.csv",
    )

    model = PredictiveModel.query.filter(
        PredictiveModel.dataset_given_id == dataset_given_id,
        PredictiveModel.pred_model_feature_id == sox10.entrez_id,
        PredictiveModel.label == "DNA_based",
    ).one()
    assert model.label == "DNA_based"
    feature_results = list(model.feature_results)
    feature_results.sort(key=lambda x: x.rank)

    assert feature_results[0].feature.feature_id == "melanoma_Lin"
    assert feature_results[0].importance == pytest.approx(0.5886725897727542)

    assert feature_results[9].feature.feature_id == "PSG7_(5676)_CN"
    assert feature_results[9].importance == pytest.approx(0.004364245039493258)
