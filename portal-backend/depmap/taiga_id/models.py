from typing import Optional

from sqlalchemy.orm.exc import NoResultFound

from depmap.database import Column, Model, String


class TaigaAlias(Model):
    __tablename__ = "taiga_alias"
    taiga_id = Column(String, primary_key=True, nullable=False)
    canonical_taiga_id = Column(String, nullable=False)

    @staticmethod
    def get_canonical_taiga_id(taiga_id, must=True) -> Optional[str]:
        q = TaigaAlias.query.filter(TaigaAlias.taiga_id == taiga_id)
        if must:
            try:
                result = q.one()
            except NoResultFound:
                raise NoResultFound(
                    "Could not find TaigaAlias where taiga_id = {}".format(taiga_id)
                )
        else:
            result = q.one_or_none()
            if result is None:
                return None
        return result.canonical_taiga_id

    @staticmethod
    def taiga_id_is_canonical(taiga_id):
        return (
            taiga_id
            == TaigaAlias.query.filter_by(taiga_id=taiga_id).one().canonical_taiga_id
        )
