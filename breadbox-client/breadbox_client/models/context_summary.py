from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ContextSummary")


@_attrs_define
class ContextSummary:
    """
    Attributes:
        num_candidates (int):
        num_matches (int):
    """

    num_candidates: int
    num_matches: int
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        num_candidates = self.num_candidates

        num_matches = self.num_matches

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "num_candidates": num_candidates,
                "num_matches": num_matches,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        num_candidates = d.pop("num_candidates")

        num_matches = d.pop("num_matches")

        context_summary = cls(
            num_candidates=num_candidates,
            num_matches=num_matches,
        )

        context_summary.additional_properties = d
        return context_summary

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
