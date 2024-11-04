from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ExportDatasetResponse")


@_attrs_define
class ExportDatasetResponse:
    """
    Attributes:
        id (str):
        state (str):
        message (Union[None, Unset, str]):
        percent_complete (Union[None, Unset, int]):
        result (Union[Any, None, Unset]):
    """

    id: str
    state: str
    message: Union[None, Unset, str] = UNSET
    percent_complete: Union[None, Unset, int] = UNSET
    result: Union[Any, None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id

        state = self.state

        message: Union[None, Unset, str]
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message

        percent_complete: Union[None, Unset, int]
        if isinstance(self.percent_complete, Unset):
            percent_complete = UNSET
        else:
            percent_complete = self.percent_complete

        result: Union[Any, None, Unset]
        if isinstance(self.result, Unset):
            result = UNSET
        else:
            result = self.result

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "state": state,
            }
        )
        if message is not UNSET:
            field_dict["message"] = message
        if percent_complete is not UNSET:
            field_dict["percentComplete"] = percent_complete
        if result is not UNSET:
            field_dict["result"] = result

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id = d.pop("id")

        state = d.pop("state")

        def _parse_message(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        message = _parse_message(d.pop("message", UNSET))

        def _parse_percent_complete(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        percent_complete = _parse_percent_complete(d.pop("percentComplete", UNSET))

        def _parse_result(data: object) -> Union[Any, None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[Any, None, Unset], data)

        result = _parse_result(d.pop("result", UNSET))

        export_dataset_response = cls(
            id=id,
            state=state,
            message=message,
            percent_complete=percent_complete,
            result=result,
        )

        export_dataset_response.additional_properties = d
        return export_dataset_response

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
