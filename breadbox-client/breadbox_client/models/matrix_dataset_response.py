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

from ..models.matrix_dataset_response_format import MatrixDatasetResponseFormat
from ..models.value_type import ValueType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.group import Group
    from ..models.matrix_dataset_response_dataset_metadata_type_0 import (
        MatrixDatasetResponseDatasetMetadataType0,
    )


T = TypeVar("T", bound="MatrixDatasetResponse")


@_attrs_define
class MatrixDatasetResponse:
    """
    Attributes:
        allowed_values (Union[List[str], None]):
        data_type (str):
        dataset_metadata (Union['MatrixDatasetResponseDatasetMetadataType0', None]):
        feature_type_name (Union[None, str]):
        group (Group):
        group_id (str):
        id (str):
        name (str):
        sample_type_name (str):
        units (str):
        value_type (ValueType):
        dataset_md5 (Union[None, Unset, str]):
        description (Union[None, Unset, str]): an optional long description of the dataset
        format_ (Union[Unset, MatrixDatasetResponseFormat]):  Default: MatrixDatasetResponseFormat.MATRIX_DATASET.
        given_id (Union[None, Unset, str]):
        is_transient (Union[Unset, bool]):  Default: False.
        priority (Union[None, Unset, int]):
        short_name (Union[None, Unset, str]): an optional short label describing dataset
        taiga_id (Union[None, Unset, str]):
        version (Union[None, Unset, str]): an optional short version identifier
    """

    allowed_values: Union[List[str], None]
    data_type: str
    dataset_metadata: Union["MatrixDatasetResponseDatasetMetadataType0", None]
    feature_type_name: Union[None, str]
    group: "Group"
    group_id: str
    id: str
    name: str
    sample_type_name: str
    units: str
    value_type: ValueType
    dataset_md5: Union[None, Unset, str] = UNSET
    description: Union[None, Unset, str] = UNSET
    format_: Union[Unset, MatrixDatasetResponseFormat] = (
        MatrixDatasetResponseFormat.MATRIX_DATASET
    )
    given_id: Union[None, Unset, str] = UNSET
    is_transient: Union[Unset, bool] = False
    priority: Union[None, Unset, int] = UNSET
    short_name: Union[None, Unset, str] = UNSET
    taiga_id: Union[None, Unset, str] = UNSET
    version: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.matrix_dataset_response_dataset_metadata_type_0 import (
            MatrixDatasetResponseDatasetMetadataType0,
        )

        allowed_values: Union[List[str], None]
        if isinstance(self.allowed_values, list):
            allowed_values = self.allowed_values

        else:
            allowed_values = self.allowed_values

        data_type = self.data_type

        dataset_metadata: Union[Dict[str, Any], None]
        if isinstance(self.dataset_metadata, MatrixDatasetResponseDatasetMetadataType0):
            dataset_metadata = self.dataset_metadata.to_dict()
        else:
            dataset_metadata = self.dataset_metadata

        feature_type_name: Union[None, str]
        feature_type_name = self.feature_type_name

        group = self.group.to_dict()

        group_id = self.group_id

        id = self.id

        name = self.name

        sample_type_name = self.sample_type_name

        units = self.units

        value_type = self.value_type.value

        dataset_md5: Union[None, Unset, str]
        if isinstance(self.dataset_md5, Unset):
            dataset_md5 = UNSET
        else:
            dataset_md5 = self.dataset_md5

        description: Union[None, Unset, str]
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        format_: Union[Unset, str] = UNSET
        if not isinstance(self.format_, Unset):
            format_ = self.format_.value

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
                "allowed_values": allowed_values,
                "data_type": data_type,
                "dataset_metadata": dataset_metadata,
                "feature_type_name": feature_type_name,
                "group": group,
                "group_id": group_id,
                "id": id,
                "name": name,
                "sample_type_name": sample_type_name,
                "units": units,
                "value_type": value_type,
            }
        )
        if dataset_md5 is not UNSET:
            field_dict["dataset_md5"] = dataset_md5
        if description is not UNSET:
            field_dict["description"] = description
        if format_ is not UNSET:
            field_dict["format"] = format_
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
        from ..models.group import Group
        from ..models.matrix_dataset_response_dataset_metadata_type_0 import (
            MatrixDatasetResponseDatasetMetadataType0,
        )

        d = src_dict.copy()

        def _parse_allowed_values(data: object) -> Union[List[str], None]:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                allowed_values_type_0 = cast(List[str], data)

                return allowed_values_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None], data)

        allowed_values = _parse_allowed_values(d.pop("allowed_values"))

        data_type = d.pop("data_type")

        def _parse_dataset_metadata(
            data: object,
        ) -> Union["MatrixDatasetResponseDatasetMetadataType0", None]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_metadata_type_0 = (
                    MatrixDatasetResponseDatasetMetadataType0.from_dict(data)
                )

                return dataset_metadata_type_0
            except:  # noqa: E722
                pass
            return cast(Union["MatrixDatasetResponseDatasetMetadataType0", None], data)

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata"))

        def _parse_feature_type_name(data: object) -> Union[None, str]:
            if data is None:
                return data
            return cast(Union[None, str], data)

        feature_type_name = _parse_feature_type_name(d.pop("feature_type_name"))

        group = Group.from_dict(d.pop("group"))

        group_id = d.pop("group_id")

        id = d.pop("id")

        name = d.pop("name")

        sample_type_name = d.pop("sample_type_name")

        units = d.pop("units")

        value_type = ValueType(d.pop("value_type"))

        def _parse_dataset_md5(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        dataset_md5 = _parse_dataset_md5(d.pop("dataset_md5", UNSET))

        def _parse_description(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        description = _parse_description(d.pop("description", UNSET))

        _format_ = d.pop("format", UNSET)
        format_: Union[Unset, MatrixDatasetResponseFormat]
        if isinstance(_format_, Unset):
            format_ = UNSET
        else:
            format_ = MatrixDatasetResponseFormat(_format_)

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

        matrix_dataset_response = cls(
            allowed_values=allowed_values,
            data_type=data_type,
            dataset_metadata=dataset_metadata,
            feature_type_name=feature_type_name,
            group=group,
            group_id=group_id,
            id=id,
            name=name,
            sample_type_name=sample_type_name,
            units=units,
            value_type=value_type,
            dataset_md5=dataset_md5,
            description=description,
            format_=format_,
            given_id=given_id,
            is_transient=is_transient,
            priority=priority,
            short_name=short_name,
            taiga_id=taiga_id,
            version=version,
        )

        matrix_dataset_response.additional_properties = d
        return matrix_dataset_response

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
