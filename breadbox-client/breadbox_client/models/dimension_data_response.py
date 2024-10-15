from typing import (
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

T = TypeVar("T", bound="DimensionDataResponse")


@_attrs_define
class DimensionDataResponse:
    """
    Attributes:
        ids (List[str]):
        labels (Union[List[str], None]):
        values (List[Any]):
    """

    ids: List[str]
    labels: Union[List[str], None]
    values: List[Any]
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        ids = self.ids

        labels: Union[List[str], None]
        if isinstance(self.labels, list):
            labels = self.labels

        else:
            labels = self.labels

        values = self.values

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "ids": ids,
                "labels": labels,
                "values": values,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        ids = cast(List[str], d.pop("ids"))

        def _parse_labels(data: object) -> Union[List[str], None]:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                labels_type_0 = cast(List[str], data)

                return labels_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None], data)

        labels = _parse_labels(d.pop("labels"))

        values = cast(List[Any], d.pop("values"))

        dimension_data_response = cls(
            ids=ids,
            labels=labels,
            values=values,
        )

        dimension_data_response.additional_properties = d
        return dimension_data_response

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
