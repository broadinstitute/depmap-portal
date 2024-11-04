from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.dataset_metadata_dataset_metadata import (
        DatasetMetadataDatasetMetadata,
    )


T = TypeVar("T", bound="DatasetMetadata")


@_attrs_define
class DatasetMetadata:
    """
    Attributes:
        dataset_metadata (DatasetMetadataDatasetMetadata):
    """

    dataset_metadata: "DatasetMetadataDatasetMetadata"
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        dataset_metadata = self.dataset_metadata.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dataset_metadata": dataset_metadata,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.dataset_metadata_dataset_metadata import (
            DatasetMetadataDatasetMetadata,
        )

        d = src_dict.copy()
        dataset_metadata = DatasetMetadataDatasetMetadata.from_dict(
            d.pop("dataset_metadata")
        )

        dataset_metadata = cls(
            dataset_metadata=dataset_metadata,
        )

        dataset_metadata.additional_properties = d
        return dataset_metadata

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
