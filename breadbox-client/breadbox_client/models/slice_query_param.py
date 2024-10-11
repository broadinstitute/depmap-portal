from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.slice_query_param_identifier_type import SliceQueryParamIdentifierType

T = TypeVar("T", bound="SliceQueryParam")


@_attrs_define
class SliceQueryParam:
    """
    Attributes:
        dataset_id (str):
        identifier (str):
        identifier_type (SliceQueryParamIdentifierType):
    """

    dataset_id: str
    identifier: str
    identifier_type: SliceQueryParamIdentifierType
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        dataset_id = self.dataset_id

        identifier = self.identifier

        identifier_type = self.identifier_type.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dataset_id": dataset_id,
                "identifier": identifier,
                "identifier_type": identifier_type,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        dataset_id = d.pop("dataset_id")

        identifier = d.pop("identifier")

        identifier_type = SliceQueryParamIdentifierType(d.pop("identifier_type"))

        slice_query_param = cls(
            dataset_id=dataset_id,
            identifier=identifier,
            identifier_type=identifier_type,
        )

        slice_query_param.additional_properties = d
        return slice_query_param

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
