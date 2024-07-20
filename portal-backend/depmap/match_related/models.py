import os
from typing import Optional, Set
from depmap.database import Column, ForeignKey, Integer, String, Model, db, relationship
import json


class RelatedEntityIndex(Model):
    __tablename__ = "related_entity_index"

    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)
    entity = relationship(
        "Entity", foreign_keys="RelatedEntityIndex.entity_id", uselist=False
    )

    related_entity_ids_json = Column(String, nullable=False)

    @classmethod
    def get(cls, entity_id: int) -> Optional["RelatedEntityIndex"]:
        return db.session.query(cls).get(entity_id)

    def set_related_entity_ids(self, ids: Set[int]):
        self.related_entity_ids_json = json.dumps(list(ids))

    def get_related_entity_ids(self) -> Set[int]:
        return set(json.loads(self.related_entity_ids_json))
