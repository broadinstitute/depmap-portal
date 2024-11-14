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
    __table_args__ = (
        db.UniqueConstraint(
            "oncotree_code",
            "depmap_model_type",
            name="uc_oncotree_code_depmap_model_type",
        ),
    )

    subtype_node_id = Column(Integer, primary_key=True, autoincrement=True)
    oncotree_code = Column(String)
    depmap_model_type = Column(String)
    node_name = Column(String, nullable=True)
    node_level = Column(Integer, nullable=False)
    level_0 = Column(String, nullable=False)
    level_1 = Column(String, nullable=True)
    level_2 = Column(String, nullable=True)
    level_3 = Column(String, nullable=True)
    level_4 = Column(String, nullable=True)
    level_5 = Column(String, nullable=True)
    subtype_node_alias = relationship("SubtypeNodeAlias", lazy="dynamic")


class SubtypeNodeAlias(Model):
    """
    Just holds a string.
    """

    __tablename__ = "subtype_node_alias"
    subtype_node_alias_id = Column(Integer, primary_key=True, autoincrement=True)
    alias_name = Column(String, nullable=False, index=True)
    subtype_node_id = Column(
        Integer, ForeignKey("subtype_node.subtype_node_id"), nullable=False
    )
    subtype_node = relationship(
        "SubtypeNode",
        foreign_keys="SubtypeNodeAlias.subtype_node_alias_id",
        uselist=False,
        overlaps="subtype_node_alias",
    )
