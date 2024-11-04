from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.column_metadata import ColumnMetadata


T = TypeVar("T", bound="TabularDatasetResponseColumnsMetadata")


@_attrs_define
class TabularDatasetResponseColumnsMetadata:
    """Dictionary containing info about each column in the table dataset format."""

    additional_properties: Dict[str, "ColumnMetadata"] = _attrs_field(
        init=False, factory=dict
    )

    def to_dict(self) -> Dict[str, Any]:
        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.column_metadata import ColumnMetadata

        d = src_dict.copy()
        tabular_dataset_response_columns_metadata = cls()

        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = ColumnMetadata.from_dict(prop_dict)

            additional_properties[prop_name] = additional_property

        tabular_dataset_response_columns_metadata.additional_properties = (
            additional_properties
        )
        return tabular_dataset_response_columns_metadata

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> "ColumnMetadata":
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: "ColumnMetadata") -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
