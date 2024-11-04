from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.annotation_type_map_annotation_type_mapping import (
        AnnotationTypeMapAnnotationTypeMapping,
    )


T = TypeVar("T", bound="AnnotationTypeMap")


@_attrs_define
class AnnotationTypeMap:
    """
    Attributes:
        annotation_type_mapping (AnnotationTypeMapAnnotationTypeMapping):
    """

    annotation_type_mapping: "AnnotationTypeMapAnnotationTypeMapping"
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        annotation_type_mapping = self.annotation_type_mapping.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "annotation_type_mapping": annotation_type_mapping,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.annotation_type_map_annotation_type_mapping import (
            AnnotationTypeMapAnnotationTypeMapping,
        )

        d = src_dict.copy()
        annotation_type_mapping = AnnotationTypeMapAnnotationTypeMapping.from_dict(
            d.pop("annotation_type_mapping")
        )

        annotation_type_map = cls(
            annotation_type_mapping=annotation_type_mapping,
        )

        annotation_type_map.additional_properties = d
        return annotation_type_map

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
