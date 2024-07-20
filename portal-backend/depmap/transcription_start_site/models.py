from typing import List

from depmap.database import Column, ForeignKey, Integer, String, relationship
from depmap.entity.models import Entity
from depmap.gene.models import Gene


class TranscriptionStartSite(Entity):
    """
    For this entity, label is something like LOC100288069_1_714068_715068 i.e. <gene>_<chromosome>_<fpos>_<tpos>
    """

    __tablename__ = "transcription_start_site"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)
    gene_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene = relationship(
        "Gene", foreign_keys="TranscriptionStartSite.gene_id", uselist=False
    )

    chromosome = Column(String, nullable=False)
    five_prime_position = Column(Integer, nullable=False)
    three_prime_position = Column(Integer, nullable=False)
    average_coverage = Column(Integer, nullable=False)

    __mapper_args__ = {"polymorphic_identity": "transcription_start_site"}

    @staticmethod
    def get_from_gene_symbol(gene_symbol):
        tss_objects = (
            TranscriptionStartSite.query.join(Gene, TranscriptionStartSite.gene)
            .filter(Gene.label == gene_symbol)
            .all()
        )
        return tss_objects

    @staticmethod
    def get_from_gene_id(gene_id):
        return (
            TranscriptionStartSite.query.join(Gene, TranscriptionStartSite.gene)
            .filter(Gene.entity_id == gene_id)
            .all()
        )

    @staticmethod
    def get_by_label(label, must=True):
        q = TranscriptionStartSite.query.filter(TranscriptionStartSite.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()
