from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.add_dimension_type_axis import AddDimensionTypeAxis

T = TypeVar("T", bound="AddDimensionType")


@_attrs_define
class AddDimensionType:
    """
    Attributes:
        axis (AddDimensionTypeAxis):
        id_column (str):
        name (str):
    """

    axis: AddDimensionTypeAxis
    id_column: str
    name: str
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        axis = self.axis.value

        id_column = self.id_column

        name = self.name

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "axis": axis,
                "id_column": id_column,
                "name": name,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        axis = AddDimensionTypeAxis(d.pop("axis"))

        id_column = d.pop("id_column")

        name = d.pop("name")

        add_dimension_type = cls(
            axis=axis,
            id_column=id_column,
            name=name,
        )

        add_dimension_type.additional_properties = d
        return add_dimension_type

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
