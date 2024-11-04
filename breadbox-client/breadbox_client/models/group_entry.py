from typing import Any, Dict, List, Type, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.access_type import AccessType
from ..types import UNSET, Unset

T = TypeVar("T", bound="GroupEntry")


@_attrs_define
class GroupEntry:
    """
    Attributes:
        access_type (AccessType):
        email (str):
        id (str):
        exact_match (Union[Unset, bool]):  Default: True.
    """

    access_type: AccessType
    email: str
    id: str
    exact_match: Union[Unset, bool] = True
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        access_type = self.access_type.value

        email = self.email

        id = self.id

        exact_match = self.exact_match

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "access_type": access_type,
                "email": email,
                "id": id,
            }
        )
        if exact_match is not UNSET:
            field_dict["exact_match"] = exact_match

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        access_type = AccessType(d.pop("access_type"))

        email = d.pop("email")

        id = d.pop("id")

        exact_match = d.pop("exact_match", UNSET)

        group_entry = cls(
            access_type=access_type,
            email=email,
            id=id,
            exact_match=exact_match,
        )

        group_entry.additional_properties = d
        return group_entry

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
