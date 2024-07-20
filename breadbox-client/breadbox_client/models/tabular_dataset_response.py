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

from ..models.tabular_dataset_response_format import TabularDatasetResponseFormat
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.group import Group
    from ..models.tabular_dataset_response_columns_metadata import (
        TabularDatasetResponseColumnsMetadata,
    )
    from ..models.tabular_dataset_response_dataset_metadata_type_0 import (
        TabularDatasetResponseDatasetMetadataType0,
    )


T = TypeVar("T", bound="TabularDatasetResponse")


@_attrs_define
class TabularDatasetResponse:
    """
    Attributes:
        columns_metadata (TabularDatasetResponseColumnsMetadata): Dictionary containing info about each column in the
            table dataset format.
        data_type (str):
        dataset_metadata (Union['TabularDatasetResponseDatasetMetadataType0', None]):
        group (Group):
        group_id (str):
        id (str):
        index_type_name (Union[None, str]):
        name (str):
        dataset_md5 (Union[None, Unset, str]):
        format_ (Union[Unset, TabularDatasetResponseFormat]):  Default: TabularDatasetResponseFormat.TABULAR_DATASET.
        is_transient (Union[Unset, bool]):  Default: False.
        priority (Union[None, Unset, int]):
        taiga_id (Union[None, Unset, str]):
    """

    columns_metadata: "TabularDatasetResponseColumnsMetadata"
    data_type: str
    dataset_metadata: Union["TabularDatasetResponseDatasetMetadataType0", None]
    group: "Group"
    group_id: str
    id: str
    index_type_name: Union[None, str]
    name: str
    dataset_md5: Union[None, Unset, str] = UNSET
    format_: Union[Unset, TabularDatasetResponseFormat] = (
        TabularDatasetResponseFormat.TABULAR_DATASET
    )
    is_transient: Union[Unset, bool] = False
    priority: Union[None, Unset, int] = UNSET
    taiga_id: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.tabular_dataset_response_dataset_metadata_type_0 import (
            TabularDatasetResponseDatasetMetadataType0,
        )

        columns_metadata = self.columns_metadata.to_dict()

        data_type = self.data_type

        dataset_metadata: Union[Dict[str, Any], None]
        if isinstance(
            self.dataset_metadata, TabularDatasetResponseDatasetMetadataType0
        ):
            dataset_metadata = self.dataset_metadata.to_dict()
        else:
            dataset_metadata = self.dataset_metadata

        group = self.group.to_dict()

        group_id = self.group_id

        id = self.id

        index_type_name: Union[None, str]
        index_type_name = self.index_type_name

        name = self.name

        dataset_md5: Union[None, Unset, str]
        if isinstance(self.dataset_md5, Unset):
            dataset_md5 = UNSET
        else:
            dataset_md5 = self.dataset_md5

        format_: Union[Unset, str] = UNSET
        if not isinstance(self.format_, Unset):
            format_ = self.format_.value

        is_transient = self.is_transient

        priority: Union[None, Unset, int]
        if isinstance(self.priority, Unset):
            priority = UNSET
        else:
            priority = self.priority

        taiga_id: Union[None, Unset, str]
        if isinstance(self.taiga_id, Unset):
            taiga_id = UNSET
        else:
            taiga_id = self.taiga_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "columns_metadata": columns_metadata,
                "data_type": data_type,
                "dataset_metadata": dataset_metadata,
                "group": group,
                "group_id": group_id,
                "id": id,
                "index_type_name": index_type_name,
                "name": name,
            }
        )
        if dataset_md5 is not UNSET:
            field_dict["dataset_md5"] = dataset_md5
        if format_ is not UNSET:
            field_dict["format"] = format_
        if is_transient is not UNSET:
            field_dict["is_transient"] = is_transient
        if priority is not UNSET:
            field_dict["priority"] = priority
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.group import Group
        from ..models.tabular_dataset_response_columns_metadata import (
            TabularDatasetResponseColumnsMetadata,
        )
        from ..models.tabular_dataset_response_dataset_metadata_type_0 import (
            TabularDatasetResponseDatasetMetadataType0,
        )

        d = src_dict.copy()
        columns_metadata = TabularDatasetResponseColumnsMetadata.from_dict(
            d.pop("columns_metadata")
        )

        data_type = d.pop("data_type")

        def _parse_dataset_metadata(
            data: object,
        ) -> Union["TabularDatasetResponseDatasetMetadataType0", None]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_metadata_type_0 = (
                    TabularDatasetResponseDatasetMetadataType0.from_dict(data)
                )

                return dataset_metadata_type_0
            except:  # noqa: E722
                pass
            return cast(Union["TabularDatasetResponseDatasetMetadataType0", None], data)

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata"))

        group = Group.from_dict(d.pop("group"))

        group_id = d.pop("group_id")

        id = d.pop("id")

        def _parse_index_type_name(data: object) -> Union[None, str]:
            if data is None:
                return data
            return cast(Union[None, str], data)

        index_type_name = _parse_index_type_name(d.pop("index_type_name"))

        name = d.pop("name")

        def _parse_dataset_md5(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        dataset_md5 = _parse_dataset_md5(d.pop("dataset_md5", UNSET))

        _format_ = d.pop("format", UNSET)
        format_: Union[Unset, TabularDatasetResponseFormat]
        if isinstance(_format_, Unset):
            format_ = UNSET
        else:
            format_ = TabularDatasetResponseFormat(_format_)

        is_transient = d.pop("is_transient", UNSET)

        def _parse_priority(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        priority = _parse_priority(d.pop("priority", UNSET))

        def _parse_taiga_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        taiga_id = _parse_taiga_id(d.pop("taiga_id", UNSET))

        tabular_dataset_response = cls(
            columns_metadata=columns_metadata,
            data_type=data_type,
            dataset_metadata=dataset_metadata,
            group=group,
            group_id=group_id,
            id=id,
            index_type_name=index_type_name,
            name=name,
            dataset_md5=dataset_md5,
            format_=format_,
            is_transient=is_transient,
            priority=priority,
            taiga_id=taiga_id,
        )

        tabular_dataset_response.additional_properties = d
        return tabular_dataset_response

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
