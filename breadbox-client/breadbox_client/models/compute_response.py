from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ComputeResponse")


@_attrs_define
class ComputeResponse:
    """
    Attributes:
        id (str):
        message (Union[None, str]):
        percent_complete (Union[None, int]):
        result (Union[Any, None]):
        state (str):
    """

    id: str
    message: Union[None, str]
    percent_complete: Union[None, int]
    result: Union[Any, None]
    state: str
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id

        message: Union[None, str]
        message = self.message

        percent_complete: Union[None, int]
        percent_complete = self.percent_complete

        result: Union[Any, None]
        result = self.result

        state = self.state

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "message": message,
                "percentComplete": percent_complete,
                "result": result,
                "state": state,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id = d.pop("id")

        def _parse_message(data: object) -> Union[None, str]:
            if data is None:
                return data
            return cast(Union[None, str], data)

        message = _parse_message(d.pop("message"))

        def _parse_percent_complete(data: object) -> Union[None, int]:
            if data is None:
                return data
            return cast(Union[None, int], data)

        percent_complete = _parse_percent_complete(d.pop("percentComplete"))

        def _parse_result(data: object) -> Union[Any, None]:
            if data is None:
                return data
            return cast(Union[Any, None], data)

        result = _parse_result(d.pop("result"))

        state = d.pop("state")

        compute_response = cls(
            id=id,
            message=message,
            percent_complete=percent_complete,
            result=result,
            state=state,
        )

        compute_response.additional_properties = d
        return compute_response

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
