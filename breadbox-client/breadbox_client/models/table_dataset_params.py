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

from ..models.table_dataset_params_format import TableDatasetParamsFormat
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.table_dataset_params_columns_metadata import (
        TableDatasetParamsColumnsMetadata,
    )
    from ..models.table_dataset_params_dataset_metadata_type_0 import (
        TableDatasetParamsDatasetMetadataType0,
    )


T = TypeVar("T", bound="TableDatasetParams")


@_attrs_define
class TableDatasetParams:
    """
    Attributes:
        columns_metadata (TableDatasetParamsColumnsMetadata): Dictionary containing info about each column in the table
            dataset format.
        data_type (str): Data type grouping for your dataset
        dataset_md5 (str): MD5 hash for entire dataset file
        file_ids (List[str]): Ordered list of file ids from the chunked dataset uploads
        format_ (TableDatasetParamsFormat):
        group_id (str): ID of the group the dataset belongs to. Required for non-transient datasets. The public group is
            `00000000-0000-0000-0000-000000000000`
        index_type (str): Feature type or sample type name that is used as index in the table dataset format. Used to
            validate the identifier of the dimension type is included in the dataset.
        name (str): Name of dataset
        dataset_metadata (Union['TableDatasetParamsDatasetMetadataType0', None, Unset]): Contains a dictionary of
            additional dataset values that are not already provided above.
        given_id (Union[None, Unset, str]): Stable human-readable identifier that the portal uses to look up specific
            datasets.
        is_transient (Union[Unset, bool]): Transient datasets can be deleted - should only be set to true for non-public
            short-term-use datasets like custom analysis results. Default: False.
        priority (Union[None, Unset, int]): Numeric value assigned to the dataset with `1` being highest priority within
            the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.
        taiga_id (Union[None, Unset, str]): Taiga ID the dataset is sourced from.
    """

    columns_metadata: "TableDatasetParamsColumnsMetadata"
    data_type: str
    dataset_md5: str
    file_ids: List[str]
    format_: TableDatasetParamsFormat
    group_id: str
    index_type: str
    name: str
    dataset_metadata: Union["TableDatasetParamsDatasetMetadataType0", None, Unset] = (
        UNSET
    )
    given_id: Union[None, Unset, str] = UNSET
    is_transient: Union[Unset, bool] = False
    priority: Union[None, Unset, int] = UNSET
    taiga_id: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.table_dataset_params_dataset_metadata_type_0 import (
            TableDatasetParamsDatasetMetadataType0,
        )

        columns_metadata = self.columns_metadata.to_dict()

        data_type = self.data_type

        dataset_md5 = self.dataset_md5

        file_ids = self.file_ids

        format_ = self.format_.value

        group_id = self.group_id

        index_type = self.index_type

        name = self.name

        dataset_metadata: Union[Dict[str, Any], None, Unset]
        if isinstance(self.dataset_metadata, Unset):
            dataset_metadata = UNSET
        elif isinstance(self.dataset_metadata, TableDatasetParamsDatasetMetadataType0):
            dataset_metadata = self.dataset_metadata.to_dict()
        else:
            dataset_metadata = self.dataset_metadata

        given_id: Union[None, Unset, str]
        if isinstance(self.given_id, Unset):
            given_id = UNSET
        else:
            given_id = self.given_id

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
                "dataset_md5": dataset_md5,
                "file_ids": file_ids,
                "format": format_,
                "group_id": group_id,
                "index_type": index_type,
                "name": name,
            }
        )
        if dataset_metadata is not UNSET:
            field_dict["dataset_metadata"] = dataset_metadata
        if given_id is not UNSET:
            field_dict["given_id"] = given_id
        if is_transient is not UNSET:
            field_dict["is_transient"] = is_transient
        if priority is not UNSET:
            field_dict["priority"] = priority
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.table_dataset_params_columns_metadata import (
            TableDatasetParamsColumnsMetadata,
        )
        from ..models.table_dataset_params_dataset_metadata_type_0 import (
            TableDatasetParamsDatasetMetadataType0,
        )

        d = src_dict.copy()
        columns_metadata = TableDatasetParamsColumnsMetadata.from_dict(
            d.pop("columns_metadata")
        )

        data_type = d.pop("data_type")

        dataset_md5 = d.pop("dataset_md5")

        file_ids = cast(List[str], d.pop("file_ids"))

        format_ = TableDatasetParamsFormat(d.pop("format"))

        group_id = d.pop("group_id")

        index_type = d.pop("index_type")

        name = d.pop("name")

        def _parse_dataset_metadata(
            data: object,
        ) -> Union["TableDatasetParamsDatasetMetadataType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_metadata_type_0 = (
                    TableDatasetParamsDatasetMetadataType0.from_dict(data)
                )

                return dataset_metadata_type_0
            except:  # noqa: E722
                pass
            return cast(
                Union["TableDatasetParamsDatasetMetadataType0", None, Unset], data
            )

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata", UNSET))

        def _parse_given_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        given_id = _parse_given_id(d.pop("given_id", UNSET))

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

        table_dataset_params = cls(
            columns_metadata=columns_metadata,
            data_type=data_type,
            dataset_md5=dataset_md5,
            file_ids=file_ids,
            format_=format_,
            group_id=group_id,
            index_type=index_type,
            name=name,
            dataset_metadata=dataset_metadata,
            given_id=given_id,
            is_transient=is_transient,
            priority=priority,
            taiga_id=taiga_id,
        )

        table_dataset_params.additional_properties = d
        return table_dataset_params

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
