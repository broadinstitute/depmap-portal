from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="FormattedMetadata")


@_attrs_define
class FormattedMetadata:
    """
    Attributes:
        annotation_type (str):
        given_id (str):
        value (Any):
    """

    annotation_type: str
    given_id: str
    value: Any
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        annotation_type = self.annotation_type

        given_id = self.given_id

        value = self.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "annotation_type": annotation_type,
                "given_id": given_id,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        annotation_type = d.pop("annotation_type")

        given_id = d.pop("given_id")

        value = d.pop("value")

        formatted_metadata = cls(
            annotation_type=annotation_type,
            given_id=given_id,
            value=value,
        )

        formatted_metadata.additional_properties = d
        return formatted_metadata

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
