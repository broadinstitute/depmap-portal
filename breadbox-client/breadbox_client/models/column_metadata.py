from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.annotation_type import AnnotationType
from ..types import UNSET, Unset

T = TypeVar("T", bound="ColumnMetadata")


@_attrs_define
class ColumnMetadata:
    """
    Attributes:
        col_type (AnnotationType):
        references (Union[None, Unset, str]): If specified, the value in this column is interpreted as an IDs in the
            named dimension type.
        units (Union[None, Unset, str]): Units for the values in the column, used for display
    """

    col_type: AnnotationType
    references: Union[None, Unset, str] = UNSET
    units: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        col_type = self.col_type.value

        references: Union[None, Unset, str]
        if isinstance(self.references, Unset):
            references = UNSET
        else:
            references = self.references

        units: Union[None, Unset, str]
        if isinstance(self.units, Unset):
            units = UNSET
        else:
            units = self.units

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "col_type": col_type,
            }
        )
        if references is not UNSET:
            field_dict["references"] = references
        if units is not UNSET:
            field_dict["units"] = units

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        col_type = AnnotationType(d.pop("col_type"))

        def _parse_references(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        references = _parse_references(d.pop("references", UNSET))

        def _parse_units(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        units = _parse_units(d.pop("units", UNSET))

        column_metadata = cls(
            col_type=col_type,
            references=references,
            units=units,
        )

        column_metadata.additional_properties = d
        return column_metadata

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
