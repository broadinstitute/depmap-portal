from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.matrix_dataset_params_data_file_format import (
    MatrixDatasetParamsDataFileFormat,
)
from ..models.matrix_dataset_params_format import MatrixDatasetParamsFormat
from ..models.value_type import ValueType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.matrix_dataset_params_dataset_metadata_type_0 import (
        MatrixDatasetParamsDatasetMetadataType0,
    )


T = TypeVar("T", bound="MatrixDatasetParams")


@_attrs_define
class MatrixDatasetParams:
    """
    Attributes:
        data_type (str): Data type grouping for your dataset
        dataset_md5 (str): MD5 hash for entire dataset file
        file_ids (List[str]): Ordered list of file ids from the chunked dataset uploads
        format_ (MatrixDatasetParamsFormat):
        group_id (str): ID of the group the dataset belongs to. Required for non-transient datasets. The public group is
            `00000000-0000-0000-0000-000000000000`
        name (str): Name of dataset
        sample_type (str): Type of samples your dataset contains
        units (str): Units for the values in the dataset, used for display
        value_type (ValueType):
        allowed_values (Union[List[str], None, Unset]): Only provide if 'value_type' is 'categorical'. Must contain all
            possible categorical values
        data_file_format (Union[Unset, MatrixDatasetParamsDataFileFormat]): The format of the uploaded data file. May
            either be 'csv' or 'parquet' Default: MatrixDatasetParamsDataFileFormat.CSV.
        dataset_metadata (Union['MatrixDatasetParamsDatasetMetadataType0', None, Unset]): Contains a dictionary of
            additional dataset values that are not already provided above.
        description (Union[None, Unset, str]): an optional long description of the dataset
        feature_type (Union[None, Unset, str]): Type of features your dataset contains
        given_id (Union[None, Unset, str]): Stable human-readable identifier that the portal uses to look up specific
            datasets.
        is_transient (Union[Unset, bool]): Transient datasets can be deleted - should only be set to true for non-public
            short-term-use datasets like custom analysis results. Default: False.
        priority (Union[None, Unset, int]): Numeric value assigned to the dataset with `1` being highest priority within
            the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.
        short_name (Union[None, Unset, str]): an optional short label describing dataset
        taiga_id (Union[None, Unset, str]): Taiga ID the dataset is sourced from.
        version (Union[None, Unset, str]): an optional short version identifier
    """

    data_type: str
    dataset_md5: str
    file_ids: List[str]
    format_: MatrixDatasetParamsFormat
    group_id: str
    name: str
    sample_type: str
    units: str
    value_type: ValueType
    allowed_values: Union[List[str], None, Unset] = UNSET
    data_file_format: Union[Unset, MatrixDatasetParamsDataFileFormat] = (
        MatrixDatasetParamsDataFileFormat.CSV
    )
    dataset_metadata: Union["MatrixDatasetParamsDatasetMetadataType0", None, Unset] = (
        UNSET
    )
    description: Union[None, Unset, str] = UNSET
    feature_type: Union[None, Unset, str] = UNSET
    given_id: Union[None, Unset, str] = UNSET
    is_transient: Union[Unset, bool] = False
    priority: Union[None, Unset, int] = UNSET
    short_name: Union[None, Unset, str] = UNSET
    taiga_id: Union[None, Unset, str] = UNSET
    version: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.matrix_dataset_params_dataset_metadata_type_0 import (
            MatrixDatasetParamsDatasetMetadataType0,
        )

        data_type = self.data_type

        dataset_md5 = self.dataset_md5

        file_ids = self.file_ids

        format_ = self.format_.value

        group_id = self.group_id

        name = self.name

        sample_type = self.sample_type

        units = self.units

        value_type = self.value_type.value

        allowed_values: Union[List[str], None, Unset]
        if isinstance(self.allowed_values, Unset):
            allowed_values = UNSET
        elif isinstance(self.allowed_values, list):
            allowed_values = self.allowed_values

        else:
            allowed_values = self.allowed_values

        data_file_format: Union[Unset, str] = UNSET
        if not isinstance(self.data_file_format, Unset):
            data_file_format = self.data_file_format.value

        dataset_metadata: Union[Dict[str, Any], None, Unset]
        if isinstance(self.dataset_metadata, Unset):
            dataset_metadata = UNSET
        elif isinstance(self.dataset_metadata, MatrixDatasetParamsDatasetMetadataType0):
            dataset_metadata = self.dataset_metadata.to_dict()
        else:
            dataset_metadata = self.dataset_metadata

        description: Union[None, Unset, str]
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        feature_type: Union[None, Unset, str]
        if isinstance(self.feature_type, Unset):
            feature_type = UNSET
        else:
            feature_type = self.feature_type

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

        short_name: Union[None, Unset, str]
        if isinstance(self.short_name, Unset):
            short_name = UNSET
        else:
            short_name = self.short_name

        taiga_id: Union[None, Unset, str]
        if isinstance(self.taiga_id, Unset):
            taiga_id = UNSET
        else:
            taiga_id = self.taiga_id

        version: Union[None, Unset, str]
        if isinstance(self.version, Unset):
            version = UNSET
        else:
            version = self.version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "data_type": data_type,
                "dataset_md5": dataset_md5,
                "file_ids": file_ids,
                "format": format_,
                "group_id": group_id,
                "name": name,
                "sample_type": sample_type,
                "units": units,
                "value_type": value_type,
            }
        )
        if allowed_values is not UNSET:
            field_dict["allowed_values"] = allowed_values
        if data_file_format is not UNSET:
            field_dict["data_file_format"] = data_file_format
        if dataset_metadata is not UNSET:
            field_dict["dataset_metadata"] = dataset_metadata
        if description is not UNSET:
            field_dict["description"] = description
        if feature_type is not UNSET:
            field_dict["feature_type"] = feature_type
        if given_id is not UNSET:
            field_dict["given_id"] = given_id
        if is_transient is not UNSET:
            field_dict["is_transient"] = is_transient
        if priority is not UNSET:
            field_dict["priority"] = priority
        if short_name is not UNSET:
            field_dict["short_name"] = short_name
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id
        if version is not UNSET:
            field_dict["version"] = version

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.matrix_dataset_params_dataset_metadata_type_0 import (
            MatrixDatasetParamsDatasetMetadataType0,
        )

        d = src_dict.copy()
        data_type = d.pop("data_type")

        dataset_md5 = d.pop("dataset_md5")

        file_ids = cast(List[str], d.pop("file_ids"))

        format_ = MatrixDatasetParamsFormat(d.pop("format"))

        group_id = d.pop("group_id")

        name = d.pop("name")

        sample_type = d.pop("sample_type")

        units = d.pop("units")

        value_type = ValueType(d.pop("value_type"))

        def _parse_allowed_values(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                allowed_values_type_0 = cast(List[str], data)

                return allowed_values_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        allowed_values = _parse_allowed_values(d.pop("allowed_values", UNSET))

        _data_file_format = d.pop("data_file_format", UNSET)
        data_file_format: Union[Unset, MatrixDatasetParamsDataFileFormat]
        if isinstance(_data_file_format, Unset):
            data_file_format = UNSET
        else:
            data_file_format = MatrixDatasetParamsDataFileFormat(_data_file_format)

        def _parse_dataset_metadata(
            data: object,
        ) -> Union["MatrixDatasetParamsDatasetMetadataType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_metadata_type_0 = (
                    MatrixDatasetParamsDatasetMetadataType0.from_dict(data)
                )

                return dataset_metadata_type_0
            except:  # noqa: E722
                pass
            return cast(
                Union["MatrixDatasetParamsDatasetMetadataType0", None, Unset], data
            )

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata", UNSET))

        def _parse_description(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        description = _parse_description(d.pop("description", UNSET))

        def _parse_feature_type(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        feature_type = _parse_feature_type(d.pop("feature_type", UNSET))

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

        def _parse_short_name(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        short_name = _parse_short_name(d.pop("short_name", UNSET))

        def _parse_taiga_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        taiga_id = _parse_taiga_id(d.pop("taiga_id", UNSET))

        def _parse_version(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        version = _parse_version(d.pop("version", UNSET))

        matrix_dataset_params = cls(
            data_type=data_type,
            dataset_md5=dataset_md5,
            file_ids=file_ids,
            format_=format_,
            group_id=group_id,
            name=name,
            sample_type=sample_type,
            units=units,
            value_type=value_type,
            allowed_values=allowed_values,
            data_file_format=data_file_format,
            dataset_metadata=dataset_metadata,
            description=description,
            feature_type=feature_type,
            given_id=given_id,
            is_transient=is_transient,
            priority=priority,
            short_name=short_name,
            taiga_id=taiga_id,
            version=version,
        )

        matrix_dataset_params.additional_properties = d
        return matrix_dataset_params

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
