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

from ..models.matrix_dataset_update_params_format import MatrixDatasetUpdateParamsFormat
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.matrix_dataset_update_params_dataset_metadata_type_0 import (
        MatrixDatasetUpdateParamsDatasetMetadataType0,
    )


T = TypeVar("T", bound="MatrixDatasetUpdateParams")


@_attrs_define
class MatrixDatasetUpdateParams:
    """Matrix dataset parameters that are editable

    Attributes:
        format_ (MatrixDatasetUpdateParamsFormat):
        data_type (Union[None, Unset, str]): Data type grouping for your dataset
        dataset_metadata (Union['MatrixDatasetUpdateParamsDatasetMetadataType0', None, Unset]): A dictionary of
            additional dataset metadata that is not already provided
        description (Union[None, Unset, str]): an optional long description of the dataset
        given_id (Union[None, Unset, str]): The 'given ID' for this dataset
        group_id (Union[None, Unset, str]): Id of the group the dataset belongs to
        name (Union[None, Unset, str]): Name of dataset
        priority (Union[None, Unset, int]): Numeric value representing priority of the dataset within its `data_type`
        short_name (Union[None, Unset, str]): an optional short label describing dataset
        units (Union[None, Unset, str]): Units for the values in the dataset
        version (Union[None, Unset, str]): an optional short version identifier
    """

    format_: MatrixDatasetUpdateParamsFormat
    data_type: Union[None, Unset, str] = UNSET
    dataset_metadata: Union[
        "MatrixDatasetUpdateParamsDatasetMetadataType0", None, Unset
    ] = UNSET
    description: Union[None, Unset, str] = UNSET
    given_id: Union[None, Unset, str] = UNSET
    group_id: Union[None, Unset, str] = UNSET
    name: Union[None, Unset, str] = UNSET
    priority: Union[None, Unset, int] = UNSET
    short_name: Union[None, Unset, str] = UNSET
    units: Union[None, Unset, str] = UNSET
    version: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.matrix_dataset_update_params_dataset_metadata_type_0 import (
            MatrixDatasetUpdateParamsDatasetMetadataType0,
        )

        format_ = self.format_.value

        data_type: Union[None, Unset, str]
        if isinstance(self.data_type, Unset):
            data_type = UNSET
        else:
            data_type = self.data_type

        dataset_metadata: Union[Dict[str, Any], None, Unset]
        if isinstance(self.dataset_metadata, Unset):
            dataset_metadata = UNSET
        elif isinstance(
            self.dataset_metadata, MatrixDatasetUpdateParamsDatasetMetadataType0
        ):
            dataset_metadata = self.dataset_metadata.to_dict()
        else:
            dataset_metadata = self.dataset_metadata

        description: Union[None, Unset, str]
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        given_id: Union[None, Unset, str]
        if isinstance(self.given_id, Unset):
            given_id = UNSET
        else:
            given_id = self.given_id

        group_id: Union[None, Unset, str]
        if isinstance(self.group_id, Unset):
            group_id = UNSET
        else:
            group_id = self.group_id

        name: Union[None, Unset, str]
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name

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

        units: Union[None, Unset, str]
        if isinstance(self.units, Unset):
            units = UNSET
        else:
            units = self.units

        version: Union[None, Unset, str]
        if isinstance(self.version, Unset):
            version = UNSET
        else:
            version = self.version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "format": format_,
            }
        )
        if data_type is not UNSET:
            field_dict["data_type"] = data_type
        if dataset_metadata is not UNSET:
            field_dict["dataset_metadata"] = dataset_metadata
        if description is not UNSET:
            field_dict["description"] = description
        if given_id is not UNSET:
            field_dict["given_id"] = given_id
        if group_id is not UNSET:
            field_dict["group_id"] = group_id
        if name is not UNSET:
            field_dict["name"] = name
        if priority is not UNSET:
            field_dict["priority"] = priority
        if short_name is not UNSET:
            field_dict["short_name"] = short_name
        if units is not UNSET:
            field_dict["units"] = units
        if version is not UNSET:
            field_dict["version"] = version

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.matrix_dataset_update_params_dataset_metadata_type_0 import (
            MatrixDatasetUpdateParamsDatasetMetadataType0,
        )

        d = src_dict.copy()
        format_ = MatrixDatasetUpdateParamsFormat(d.pop("format"))

        def _parse_data_type(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        data_type = _parse_data_type(d.pop("data_type", UNSET))

        def _parse_dataset_metadata(
            data: object,
        ) -> Union["MatrixDatasetUpdateParamsDatasetMetadataType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dataset_metadata_type_0 = (
                    MatrixDatasetUpdateParamsDatasetMetadataType0.from_dict(data)
                )

                return dataset_metadata_type_0
            except:  # noqa: E722
                pass
            return cast(
                Union["MatrixDatasetUpdateParamsDatasetMetadataType0", None, Unset],
                data,
            )

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata", UNSET))

        def _parse_description(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        description = _parse_description(d.pop("description", UNSET))

        def _parse_given_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        given_id = _parse_given_id(d.pop("given_id", UNSET))

        def _parse_group_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        group_id = _parse_group_id(d.pop("group_id", UNSET))

        def _parse_name(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        name = _parse_name(d.pop("name", UNSET))

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

        def _parse_units(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        units = _parse_units(d.pop("units", UNSET))

        def _parse_version(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        version = _parse_version(d.pop("version", UNSET))

        matrix_dataset_update_params = cls(
            format_=format_,
            data_type=data_type,
            dataset_metadata=dataset_metadata,
            description=description,
            given_id=given_id,
            group_id=group_id,
            name=name,
            priority=priority,
            short_name=short_name,
            units=units,
            version=version,
        )

        matrix_dataset_update_params.additional_properties = d
        return matrix_dataset_update_params

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
