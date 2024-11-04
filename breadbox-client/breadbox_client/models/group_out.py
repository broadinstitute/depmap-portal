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
    from ..models.group_entry import GroupEntry
    from ..models.matrix_dataset_response import MatrixDatasetResponse
    from ..models.tabular_dataset_response import TabularDatasetResponse


T = TypeVar("T", bound="GroupOut")


@_attrs_define
class GroupOut:
    """
    Attributes:
        group_entries (List['GroupEntry']):
        id (str):
        name (str):
        datasets (Union[List[Union['MatrixDatasetResponse', 'TabularDatasetResponse']], None, Unset]):
    """

    group_entries: List["GroupEntry"]
    id: str
    name: str
    datasets: Union[
        List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]], None, Unset
    ] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.matrix_dataset_response import MatrixDatasetResponse

        group_entries = []
        for group_entries_item_data in self.group_entries:
            group_entries_item = group_entries_item_data.to_dict()
            group_entries.append(group_entries_item)

        id = self.id

        name = self.name

        datasets: Union[List[Dict[str, Any]], None, Unset]
        if isinstance(self.datasets, Unset):
            datasets = UNSET
        elif isinstance(self.datasets, list):
            datasets = []
            for datasets_type_0_item_data in self.datasets:
                datasets_type_0_item: Dict[str, Any]
                if isinstance(datasets_type_0_item_data, MatrixDatasetResponse):
                    datasets_type_0_item = datasets_type_0_item_data.to_dict()
                else:
                    datasets_type_0_item = datasets_type_0_item_data.to_dict()

                datasets.append(datasets_type_0_item)

        else:
            datasets = self.datasets

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "group_entries": group_entries,
                "id": id,
                "name": name,
            }
        )
        if datasets is not UNSET:
            field_dict["datasets"] = datasets

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.group_entry import GroupEntry
        from ..models.matrix_dataset_response import MatrixDatasetResponse
        from ..models.tabular_dataset_response import TabularDatasetResponse

        d = src_dict.copy()
        group_entries = []
        _group_entries = d.pop("group_entries")
        for group_entries_item_data in _group_entries:
            group_entries_item = GroupEntry.from_dict(group_entries_item_data)

            group_entries.append(group_entries_item)

        id = d.pop("id")

        name = d.pop("name")

        def _parse_datasets(
            data: object,
        ) -> Union[
            List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]], None, Unset
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                datasets_type_0 = []
                _datasets_type_0 = data
                for datasets_type_0_item_data in _datasets_type_0:

                    def _parse_datasets_type_0_item(
                        data: object,
                    ) -> Union["MatrixDatasetResponse", "TabularDatasetResponse"]:
                        try:
                            if not isinstance(data, dict):
                                raise TypeError()
                            datasets_type_0_item_type_0 = (
                                MatrixDatasetResponse.from_dict(data)
                            )

                            return datasets_type_0_item_type_0
                        except:  # noqa: E722
                            pass
                        if not isinstance(data, dict):
                            raise TypeError()
                        datasets_type_0_item_type_1 = TabularDatasetResponse.from_dict(
                            data
                        )

                        return datasets_type_0_item_type_1

                    datasets_type_0_item = _parse_datasets_type_0_item(
                        datasets_type_0_item_data
                    )

                    datasets_type_0.append(datasets_type_0_item)

                return datasets_type_0
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    List[Union["MatrixDatasetResponse", "TabularDatasetResponse"]],
                    None,
                    Unset,
                ],
                data,
            )

        datasets = _parse_datasets(d.pop("datasets", UNSET))

        group_out = cls(
            group_entries=group_entries,
            id=id,
            name=name,
            datasets=datasets,
        )

        group_out.additional_properties = d
        return group_out

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
