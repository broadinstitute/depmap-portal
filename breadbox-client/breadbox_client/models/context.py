from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    List,
    Type,
    TypeVar,
    Union,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.context_expr_type_1 import ContextExprType1
    from ..models.context_vars import ContextVars


T = TypeVar("T", bound="Context")


@_attrs_define
class Context:
    """
    Attributes:
        dimension_type (str):
        expr (Union['ContextExprType1', bool]):
        name (Union[None, Unset, str]):
        vars_ (Union[Unset, ContextVars]):
    """

    dimension_type: str
    expr: Union["ContextExprType1", bool]
    name: Union[None, Unset, str] = UNSET
    vars_: Union[Unset, "ContextVars"] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.context_expr_type_1 import ContextExprType1

        dimension_type = self.dimension_type

        expr: Union[Dict[str, Any], bool]
        if isinstance(self.expr, ContextExprType1):
            expr = self.expr.to_dict()
        else:
            expr = self.expr

        name: Union[None, Unset, str]
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name

        vars_: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.vars_, Unset):
            vars_ = self.vars_.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dimension_type": dimension_type,
                "expr": expr,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
        if vars_ is not UNSET:
            field_dict["vars"] = vars_

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.context_expr_type_1 import ContextExprType1
        from ..models.context_vars import ContextVars

        d = src_dict.copy()
        dimension_type = d.pop("dimension_type")

        def _parse_expr(data: object) -> Union["ContextExprType1", bool]:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                expr_type_1 = ContextExprType1.from_dict(data)

                return expr_type_1
            except:  # noqa: E722
                pass
            return cast(Union["ContextExprType1", bool], data)

        expr = _parse_expr(d.pop("expr"))

        def _parse_name(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        name = _parse_name(d.pop("name", UNSET))

        _vars_ = d.pop("vars", UNSET)
        vars_: Union[Unset, ContextVars]
        if isinstance(_vars_, Unset):
            vars_ = UNSET
        else:
            vars_ = ContextVars.from_dict(_vars_)

        context = cls(
            dimension_type=dimension_type,
            expr=expr,
            name=name,
            vars_=vars_,
        )

        context.additional_properties = d
        return context

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
