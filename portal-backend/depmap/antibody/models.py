from typing import List, Optional

from depmap.database import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    db,
    relationship,
)
from depmap.entity.models import Entity

# Pycharm doesn't infer their usage, but the models are needed for strings in relationship definitions
from depmap.gene.models import Gene

gene_antibody_association = db.Table(
    "gene_antibody_association",
    Column("gene_id", Integer, ForeignKey("gene.entity_id"), nullable=False),
    Column("antibody_id", Integer, ForeignKey("antibody.entity_id"), nullable=False),
)


class Antibody(Entity):
    __tablename__ = "antibody"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)
    protein = Column(String, nullable=False)
    phosphorylation = Column(String)
    gene = relationship(
        "Gene", secondary=gene_antibody_association, backref=__tablename__
    )  # m2m
    is_caution = Column(Boolean, nullable=False)
    is_validation_unavailable = Column(Boolean, nullable=False)

    __mapper_args__ = {"polymorphic_identity": "antibody"}

    @staticmethod
    def get_from_gene_symbol(gene_symbol) -> List["Antibody"]:
        antibody_objects = (
            Antibody.query.join(Gene, Antibody.gene)
            .filter(Gene.label == gene_symbol)
            .all()
        )
        return antibody_objects

    @staticmethod
    def get_from_gene_id(gene_id) -> List["Antibody"]:
        return (
            Antibody.query.join(Gene, Antibody.gene)
            .filter(Gene.entity_id == gene_id)
            .all()
        )

    @staticmethod
    def get_by_label(label, must=True) -> Optional["Antibody"]:
        q = Antibody.query.filter(Antibody.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()
