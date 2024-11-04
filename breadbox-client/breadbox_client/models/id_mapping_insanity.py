from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.id_mapping import IdMapping


T = TypeVar("T", bound="IdMappingInsanity")


@_attrs_define
class IdMappingInsanity:
    """This class exists for copying with some oddities in how the id_mapping parameter is encoded in json. There
    probably would be some better refactoring that would make this all much clearer, however, we've moved away
    from this encoding and plan to delete the endpoints that use this so I'm putting in this hack to keep things
    working until we pull the bandaid off and delete all the depreciated endpoints.

        Attributes:
            id_mapping (IdMapping):
    """

    id_mapping: "IdMapping"
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id_mapping = self.id_mapping.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id_mapping": id_mapping,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.id_mapping import IdMapping

        d = src_dict.copy()
        id_mapping = IdMapping.from_dict(d.pop("id_mapping"))

        id_mapping_insanity = cls(
            id_mapping=id_mapping,
        )

        id_mapping_insanity.additional_properties = d
        return id_mapping_insanity

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
