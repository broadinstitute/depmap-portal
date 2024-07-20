from typing import Dict, Tuple, Union

from depmap.database import Column, ForeignKey, Integer, Model, String, db, relationship

# just here to share with Dataset
# if adding, check if should be added to get_gene_compound_related_entity_type
entity_type_db_enum = db.Enum(
    "gene",
    "compound",
    "antibody",
    "transcription_start_site",
    "compound_experiment",
    "context",
    "compound_dose",
    "compound_dose_replicate",
    "protein",
    "generic_entity",
    name="EntityType",
)


class Entity(Model):
    """
    An entity is something that can be in the row dimension of a matrix
    """

    __tablename__ = "entity"
    entity_id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(entity_type_db_enum, nullable=False)
    label = Column(String(80), nullable=False)

    entity_alias = db.relationship("EntityAlias", lazy="dynamic")

    __table_args__: Union[Dict, Tuple] = (
        db.Index("ix_entity_label_type", "label", "type"),
        db.UniqueConstraint("label", "type", name="uc_entity_label_type"),
    )
    __mapper_args__ = {"polymorphic_identity": "entity", "polymorphic_on": type}

    @staticmethod
    def get_gene_compound_related_entity_types():
        return {
            "gene",
            "compound",
            "antibody",
            "transcription_start_site",
            "compound_experiment",
            "compound_dose",
            "compound_dose_replicate",
            "protein",
        }

    @classmethod
    def get_entity_type(cls):
        return cls.__mapper_args__["polymorphic_identity"]

    @staticmethod
    def get_by_entity_id(entity_id, must=True) -> "Entity":
        q = Entity.query.filter(Entity.entity_id == entity_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_label(label, must=True):
        """
        This should probably never be implemented on Entity.
        If you really think you have a use case for this, consider the following:
        Entity labels are not unique across all entities.

        In order to uniquely access an entity by label, you need to know the type. Where can that information come from?
            1. There is uniqueness of labels within a type/subclass of Entity.
                If you already know what type/subclass the will always be e.g. because this is the Gene page, you should use Gene.get_by_label
            2. There is an implicit uniqueness of entity labels within a matrix.
                Suppose you have a dataset, or a matrix, and you want whatever type of entity is in the dataset or matrix, determined at runtime.
                The only use case where you would want this is if you wanted to get an entity in the particular dataset or matrix
                    If the purpose of doing so to get a series of CellLine values for a particular entity, please use get_cell_line_values_and_depmap_ids(..., by_label=True)
                    If all you want is to get an entity in a particular dataset or matrix, please use the get_entity_by_label on a matrix object

        In other words, given that entity labels are not unique there is no use case for accessing an entity by label alone.
        This must be done in conjunction with another piece of information, in which case reconsider whether your use case is better served by a function that more directly gets to your use case, with a function put on that other piece of information.
        """
        raise NotImplementedError

    @staticmethod
    def get_entity_class_by_type(entity_type):
        """
        This method requires importing Gene, Antibody, etc.
        Thus, this is implemented on entity_utils and not here
        """
        raise NotImplementedError

    @staticmethod
    def get_label_aliases(entity_id):
        raise NotImplementedError

    @classmethod
    def get_by_id(cls, entity_id, must=True):
        """
        Class method so that we can reduce the space to search
        E.g. calling Gene.get_by_id let's just search among genes
        """
        q = cls.query.filter(cls.entity_id == entity_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()


class EntityAlias(Model):
    """
    Just holds a string.
    """

    __tablename__ = "entity_alias"
    entity_alias_id = Column(Integer, primary_key=True, autoincrement=True)
    alias = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), nullable=False)
    entity = relationship(
        "Entity",
        foreign_keys="EntityAlias.entity_id",
        uselist=False,
        overlaps="entity_alias",
    )


class GenericEntity(Entity):
    __tablename__ = "generic_entity"
    entity_id = Column(
        db.Integer(), db.ForeignKey("entity.entity_id"), primary_key=True
    )

    @staticmethod
    def get_by_label(label, must=True) -> "GenericEntity":
        q = GenericEntity.query.filter(GenericEntity.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    __mapper_args__ = {"polymorphic_identity": "generic_entity"}
