from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.add_dimension_type_axis import AddDimensionTypeAxis
from ..types import UNSET, Unset

T = TypeVar("T", bound="AddDimensionType")


@_attrs_define
class AddDimensionType:
    """
    Attributes:
        axis (AddDimensionTypeAxis):
        id_column (str):
        name (str):
        display_name (Union[None, Unset, str]):
    """

    axis: AddDimensionTypeAxis
    id_column: str
    name: str
    display_name: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        axis = self.axis.value

        id_column = self.id_column

        name = self.name

        display_name: Union[None, Unset, str]
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "axis": axis,
                "id_column": id_column,
                "name": name,
            }
        )
        if display_name is not UNSET:
            field_dict["display_name"] = display_name

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        axis = AddDimensionTypeAxis(d.pop("axis"))

        id_column = d.pop("id_column")

        name = d.pop("name")

        def _parse_display_name(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        display_name = _parse_display_name(d.pop("display_name", UNSET))

        add_dimension_type = cls(
            axis=axis,
            id_column=id_column,
            name=name,
            display_name=display_name,
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
