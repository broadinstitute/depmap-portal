from enum import Enum
from typing import Optional, Tuple

import sqlalchemy as sa

from depmap.database import Column, ForeignKey, Integer, Model, String, relationship
from depmap.dataset.models import BiomarkerDataset, Dataset, DependencyDataset

# noinspection UnusedImport
from depmap.entity.models import Entity


class SearchAxis(Enum):
    dim_0 = 0
    dim_1 = 1
    both_dim = 3


class CorrelatedDataset(Model):
    """
    This is a metadata table for accessing the correlation sqlite files
    The actual correlation numbers are stored in those sqlite files
    For getting those correlation numbers, please use get_all_correlations from utils.py
    For implementation and access details, see the docstring of _query_correlates in utils.py
    """

    __tablename__ = "correlated_dataset"

    correlated_dataset_id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_1_id = Column(Integer, ForeignKey("dataset.dataset_id"), nullable=False)
    dataset_1 = relationship(
        "Dataset", foreign_keys="CorrelatedDataset.dataset_1_id", uselist=False
    )
    dataset_2_id = Column(Integer, ForeignKey("dataset.dataset_id"), nullable=False)
    dataset_2 = relationship(
        "Dataset", foreign_keys="CorrelatedDataset.dataset_2_id", uselist=False
    )

    filename = Column(String, nullable=False)

    @classmethod
    def get_correlated_dataset_display_names(cls, matrix_id):
        """
        Must be able to:
        Detect self-correlations
        Select from either dataset column
        Take uniques (union)
        """
        dataset_id = (
            Dataset.query.filter_by(matrix_id=matrix_id)
            .with_entities(Dataset.dataset_id)
            .one()[0]
        )

        q1 = (
            cls.query.filter_by(dataset_1_id=dataset_id)
            .join(Dataset, Dataset.dataset_id == cls.dataset_2_id)
            .with_entities(Dataset.display_name)
        )
        q2 = (
            cls.query.filter_by(dataset_2_id=dataset_id)
            .join(Dataset, Dataset.dataset_id == cls.dataset_1_id)
            .with_entities(Dataset.display_name)
        )

        display_names = [x[0] for x in q1.union(q2).all()]

        return display_names

    @classmethod
    def _find_correlated_datasets(cls, matrix_id):
        dataset_ids = set(
            [
                x[0]
                for x in cls.query.join(
                    DependencyDataset, DependencyDataset.dataset_id == cls.dataset_1_id
                )
                .filter(DependencyDataset.matrix_id == matrix_id)
                .with_entities(CorrelatedDataset.dataset_2_id)
                .all()
            ]
            + [
                x[0]
                for x in cls.query.join(
                    BiomarkerDataset, BiomarkerDataset.dataset_id == cls.dataset_1_id
                )
                .filter(BiomarkerDataset.matrix_id == matrix_id)
                .with_entities(CorrelatedDataset.dataset_2_id)
                .all()
            ]
            + [
                x[0]
                for x in cls.query.join(
                    DependencyDataset, DependencyDataset.dataset_id == cls.dataset_2_id
                )
                .filter(DependencyDataset.matrix_id == matrix_id)
                .with_entities(CorrelatedDataset.dataset_1_id)
                .all()
            ]
            + [
                x[0]
                for x in cls.query.join(
                    BiomarkerDataset, BiomarkerDataset.dataset_id == cls.dataset_2_id
                )
                .filter(BiomarkerDataset.matrix_id == matrix_id)
                .with_entities(CorrelatedDataset.dataset_1_id)
                .all()
            ]
        )
        return dataset_ids

    @staticmethod
    def _get_correlation_file(
        dataset_id_1, dataset_id_2
    ) -> Optional[Tuple[str, SearchAxis]]:
        """
        fixme
        """
        file = CorrelatedDataset.query.filter(
            sa.or_(
                sa.and_(
                    CorrelatedDataset.dataset_2_id == dataset_id_1,
                    CorrelatedDataset.dataset_1_id == dataset_id_2,
                ),
                sa.and_(
                    CorrelatedDataset.dataset_1_id == dataset_id_1,
                    CorrelatedDataset.dataset_2_id == dataset_id_2,
                ),
            )
        ).one_or_none()
        if file is None:
            return None
        else:
            if file.dataset_1_id == dataset_id_1 and file.dataset_2_id == dataset_id_1:
                axis = SearchAxis.both_dim  # both axes should be checked
            elif file.dataset_1_id == dataset_id_1:
                axis = SearchAxis.dim_0
            else:
                axis = SearchAxis.dim_1
            return file.filename, axis
