from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.id_mapping_reference_column_mappings import (
        IdMappingReferenceColumnMappings,
    )


T = TypeVar("T", bound="IdMapping")


@_attrs_define
class IdMapping:
    """
    Attributes:
        reference_column_mappings (IdMappingReferenceColumnMappings):
    """

    reference_column_mappings: "IdMappingReferenceColumnMappings"
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        reference_column_mappings = self.reference_column_mappings.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "reference_column_mappings": reference_column_mappings,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.id_mapping_reference_column_mappings import (
            IdMappingReferenceColumnMappings,
        )

        d = src_dict.copy()
        reference_column_mappings = IdMappingReferenceColumnMappings.from_dict(
            d.pop("reference_column_mappings")
        )

        id_mapping = cls(
            reference_column_mappings=reference_column_mappings,
        )

        id_mapping.additional_properties = d
        return id_mapping

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
