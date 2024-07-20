from enum import Enum
from typing import List, Optional

from depmap.database import Column, Integer, Model, String, db


class CellignerEntryEnum(Enum):
    TCGA_TUMOR = "tcgaplus-tumor"
    MET500_TUMOR = "met500-tumor"
    DEPMAP_MODEL = "depmap-model"
    NOVARTIS_PDX_MODEL = "novartisPDX-model"
    PEDIATRIC_PDX_MODEL = "pediatricPDX-model"


TUMOR_TYPES = {
    CellignerEntryEnum.TCGA_TUMOR.value,
    CellignerEntryEnum.MET500_TUMOR.value,
}
MODEL_TYPES = {
    CellignerEntryEnum.DEPMAP_MODEL.value,
    CellignerEntryEnum.NOVARTIS_PDX_MODEL.value,
    CellignerEntryEnum.PEDIATRIC_PDX_MODEL.value,
}


class CellignerDistanceRowIndex(Model):
    __tablename__ = "celligner_distance_row_index"
    row_index_id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, nullable=False)
    tumor_sample_id = Column(String, nullable=False)

    @staticmethod
    def get_by_tumor_sample_id(
        tumor_sample_id: str,
    ) -> Optional["CellignerDistanceRowIndex"]:
        q = db.session.query(CellignerDistanceRowIndex).filter(
            CellignerDistanceRowIndex.tumor_sample_id == tumor_sample_id
        )
        return q.one_or_none()

    @staticmethod
    def get_by_tumor_sample_ids(
        tumor_sample_ids: List[str],
    ) -> List["CellignerDistanceRowIndex"]:
        q = db.session.query(CellignerDistanceRowIndex).filter(
            CellignerDistanceRowIndex.tumor_sample_id.in_(tumor_sample_ids)
        )
        return q.all()

    @staticmethod
    def get_by_index(index: int) -> Optional["CellignerDistanceRowIndex"]:
        q = db.session.query(CellignerDistanceRowIndex).filter(
            CellignerDistanceRowIndex.index == index
        )
        return q.one_or_none()

    @staticmethod
    def get_by_indexes(indexes: List[int]) -> List["CellignerDistanceRowIndex"]:
        q = db.session.query(CellignerDistanceRowIndex).filter(
            CellignerDistanceRowIndex.index.in_(indexes)
        )
        return q.all()


class CellignerDistanceColIndex(Model):
    __tablename__ = "celligner_distance_col_index"
    col_index_id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, nullable=False)
    sample_id = Column(String, nullable=False)

    @staticmethod
    def get_by_sample_id(sample_id: str) -> Optional["CellignerDistanceColIndex"]:
        q = db.session.query(CellignerDistanceColIndex).filter(
            CellignerDistanceColIndex.sample_id == sample_id
        )
        return q.one()

    @staticmethod
    def get_by_index(index: int) -> Optional["CellignerDistanceColIndex"]:
        q = db.session.query(CellignerDistanceColIndex).filter(
            CellignerDistanceColIndex.index == index
        )
        return q.one()
