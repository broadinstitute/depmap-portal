from depmap.database import Column, ForeignKey, Integer, String, relationship
from depmap.entity.models import Entity
from depmap.gene.models import Gene


class Protein(Entity):
    __tablename__ = "protein"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    uniprot_id = Column(String, nullable=False)
    gene_id = Column(String, ForeignKey("gene.entity_id"), nullable=True)
    gene = relationship("Gene", foreign_keys="Protein.gene_id", uselist=False)

    __mapper_args__ = {"polymorphic_identity": "protein"}

    @staticmethod
    def get_by_label(label, must=True):
        q = Protein.query.filter(Protein.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_label_aliases(protein_id):
        q = Protein.query.filter(Protein.entity_id == protein_id)
        protein = q.one()
        return protein.label, []

    @staticmethod
    def get_from_gene_symbol(gene_symbol):
        protein_objects = (
            Protein.query.join(Gene, Protein.gene)
            .filter(Gene.label == gene_symbol)
            .all()
        )
        return protein_objects

    @staticmethod
    def get_from_gene_id(gene_id):
        protein_objects = (
            Protein.query.join(Gene, Protein.gene)
            .filter(Gene.entity_id == gene_id)
            .all()
        )
        return protein_objects
