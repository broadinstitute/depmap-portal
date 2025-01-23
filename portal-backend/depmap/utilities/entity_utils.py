
from depmap.entity.models import Entity
from depmap.utilities.exception import InvalidEntityTypeError


def get_entity_class_by_name(entity_class_name: str):
    subclasses = Entity.__subclasses__()
    subclass_by_tablename = {
        subclass.__tablename__: subclass for subclass in subclasses
    }
    if entity_class_name in subclass_by_tablename:
        return subclass_by_tablename[entity_class_name]
    raise InvalidEntityTypeError(f"{entity_class_name} is not a subclass of Entity")
