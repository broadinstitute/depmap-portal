from typing import Optional
from depmap.database import (
    Column,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)


class SubtypeNode(Model):
    __tablename__ = "subtype_node"

    subtype_code = Column(String, primary_key=True, index=True)
    oncotree_code = Column(String)
    depmap_model_type = Column(String)
    node_name = Column(String, nullable=False)
    node_level = Column(Integer, nullable=False)
    level_0 = Column(String, nullable=False)
    level_1 = Column(String, nullable=True)
    level_2 = Column(String, nullable=True)
    level_3 = Column(String, nullable=True)
    level_4 = Column(String, nullable=True)
    level_5 = Column(String, nullable=True)
    subtype_node_alias = relationship("SubtypeNodeAlias", lazy="dynamic")

    @classmethod
    def get_by_code(cls, code, must=True) -> Optional["SubtypeNode"]:
        q = db.session.query(SubtypeNode).filter(SubtypeNode.subtype_code == code)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_subtype_tree_query():
        query = db.session.query(SubtypeNode).order_by(SubtypeNode.node_level)
        return query


class SubtypeNodeAlias(Model):
    """
    Just holds a string.
    """

    __tablename__ = "subtype_node_alias"
    subtype_node_alias_id = Column(Integer, primary_key=True, autoincrement=True)
    alias_name = Column(String, nullable=False, index=True)
    alias_subtype_code = Column(String, nullable=False, index=True)
    subtype_code = Column(
        String, ForeignKey("subtype_node.subtype_code"), nullable=False
    )
    subtype_node = relationship(
        "SubtypeNode",
        foreign_keys="SubtypeNodeAlias.subtype_code",
        uselist=False,
        overlaps="subtype_node_alias",
    )
