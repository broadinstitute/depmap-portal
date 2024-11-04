from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.annotation_type import AnnotationType

T = TypeVar("T", bound="AnnotationTypeMapAnnotationTypeMapping")


@_attrs_define
class AnnotationTypeMapAnnotationTypeMapping:
    """ """

    additional_properties: Dict[str, AnnotationType] = _attrs_field(
        init=False, factory=dict
    )

    def to_dict(self) -> Dict[str, Any]:
        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.value

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        annotation_type_map_annotation_type_mapping = cls()

        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = AnnotationType(prop_dict)

            additional_properties[prop_name] = additional_property

        annotation_type_map_annotation_type_mapping.additional_properties = (
            additional_properties
        )
        return annotation_type_map_annotation_type_mapping

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> AnnotationType:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: AnnotationType) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
