from typing import Any, Dict, List, Type, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ContextExprType1")


@_attrs_define
class ContextExprType1:
    """ """

    additional_properties: Dict[str, List[Any]] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        context_expr_type_1 = cls()

        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = cast(List[Any], prop_dict)

            additional_properties[prop_name] = additional_property

        context_expr_type_1.additional_properties = additional_properties
        return context_expr_type_1

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> List[Any]:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: List[Any]) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
