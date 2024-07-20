from depmap.database import Column, Model, Integer, ForeignKey, String, relationship
from depmap.dataset.models import DependencyDataset
from depmap.gene.models import Gene
from depmap.predictability.models import PredictiveModel


class TDAInterpretableModel(Model):
    __tablename__ = "tda_interpretable_model"

    interpretable_model_id = Column(Integer, primary_key=True, autoincrement=True)

    predictive_model_id = Column(
        Integer, ForeignKey("predictive_model.predictive_model_id"), nullable=False,
    )
    predictive_model = relationship(
        "PredictiveModel", foreign_keys="TDAInterpretableModel.predictive_model_id"
    )

    gene_id = Column(String, ForeignKey("gene.entity_id"), nullable=False)
    gene = relationship("Gene", foreign_keys="TDAInterpretableModel.gene_id")

    dot_graph = Column(String, nullable=False)

    @staticmethod
    def get_by_gene_label_and_dataset_name(gene_label, dataset_name, must=False):
        query = (
            TDAInterpretableModel.query.join(
                Gene, TDAInterpretableModel.gene_id == Gene.entity_id
            )
            .join(
                PredictiveModel,
                TDAInterpretableModel.predictive_model_id
                == PredictiveModel.predictive_model_id,
            )
            .join(
                DependencyDataset,
                PredictiveModel.dataset_id == DependencyDataset.dataset_id,
            )
            .filter(Gene.label == gene_label)
            .filter(DependencyDataset.name == dataset_name)
        )
        if must:
            return query.one()
        return query.one_or_none()
