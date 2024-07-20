from typing import Any, Dict, List, Type, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="UpdateDimensionType")


@_attrs_define
class UpdateDimensionType:
    """
    Attributes:
        metadata_dataset_id (str):
        properties_to_index (List[str]):
    """

    metadata_dataset_id: str
    properties_to_index: List[str]
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        metadata_dataset_id = self.metadata_dataset_id

        properties_to_index = self.properties_to_index

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "metadata_dataset_id": metadata_dataset_id,
                "properties_to_index": properties_to_index,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        metadata_dataset_id = d.pop("metadata_dataset_id")

        properties_to_index = cast(List[str], d.pop("properties_to_index"))

        update_dimension_type = cls(
            metadata_dataset_id=metadata_dataset_id,
            properties_to_index=properties_to_index,
        )

        update_dimension_type.additional_properties = d
        return update_dimension_type

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
