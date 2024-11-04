from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.formatted_metadata import FormattedMetadata


T = TypeVar("T", bound="MetadataResponse")


@_attrs_define
class MetadataResponse:
    """
    Attributes:
        label (str):
        metadata (List['FormattedMetadata']):
    """

    label: str
    metadata: List["FormattedMetadata"]
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        label = self.label

        metadata = []
        for metadata_item_data in self.metadata:
            metadata_item = metadata_item_data.to_dict()
            metadata.append(metadata_item)

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "label": label,
                "metadata": metadata,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.formatted_metadata import FormattedMetadata

        d = src_dict.copy()
        label = d.pop("label")

        metadata = []
        _metadata = d.pop("metadata")
        for metadata_item_data in _metadata:
            metadata_item = FormattedMetadata.from_dict(metadata_item_data)

            metadata.append(metadata_item)

        metadata_response = cls(
            label=label,
            metadata=metadata,
        )

        metadata_response.additional_properties = d
        return metadata_response

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
