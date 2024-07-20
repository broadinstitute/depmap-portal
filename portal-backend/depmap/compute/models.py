import json
import uuid

from depmap.database import Column, Model, Text, db


class CustomCellLineGroup(Model):
    __tablename__ = "custom_cell_line_group"
    uuid = Column(Text, primary_key=True)
    depmap_ids = Column(Text, nullable=False)

    @classmethod
    def exists(cls, uuid_str):
        return db.session.query(cls.query.filter_by(uuid=uuid_str).exists()).scalar()

    @classmethod
    def get_depmap_ids(cls, uuid_str):
        row = cls.query.get(uuid_str)
        return json.loads(row.depmap_ids)

    @classmethod
    def add(cls, depmap_ids):
        """
        Takes in depmap_ids (list)
        Depending on how this is used, it might be more convenient to take in a list of cell line objects
        :return: uuid of added group
        """
        uuid_string = str(uuid.uuid4())
        depmap_ids_string = json.dumps(depmap_ids)
        db.session.add(cls(uuid=uuid_string, depmap_ids=depmap_ids_string))
        db.session.commit()
        return uuid_string
