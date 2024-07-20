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
    from ..models.tabular_dataset_response import TabularDatasetResponse


T = TypeVar("T", bound="SampleTypeOut")


@_attrs_define
class SampleTypeOut:
    """
    Attributes:
        id_column (str):
        name (str):
        dataset (Union['TabularDatasetResponse', None, Unset]):
    """

    id_column: str
    name: str
    dataset: Union["TabularDatasetResponse", None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.tabular_dataset_response import TabularDatasetResponse

        id_column = self.id_column

        name = self.name

        dataset: Union[Dict[str, Any], None, Unset]
        if isinstance(self.dataset, Unset):
            dataset = UNSET
        elif isinstance(self.dataset, TabularDatasetResponse):
            dataset = self.dataset.to_dict()
        else:
            dataset = self.dataset

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id_column": id_column,
                "name": name,
            }
        )
        if dataset is not UNSET:
            field_dict["dataset"] = dataset

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.tabular_dataset_response import TabularDatasetResponse

        d = src_dict.copy()
        id_column = d.pop("id_column")

        name = d.pop("name")

        def _parse_dataset(
            data: object,
        ) -> Union["TabularDatasetResponse", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_type_0 = TabularDatasetResponse.from_dict(data)

                return dataset_type_0
            except:  # noqa: E722
                pass
            return cast(Union["TabularDatasetResponse", None, Unset], data)

        dataset = _parse_dataset(d.pop("dataset", UNSET))

        sample_type_out = cls(
            id_column=id_column,
            name=name,
            dataset=dataset,
        )

        sample_type_out.additional_properties = d
        return sample_type_out

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
