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
        group_id (Union[None, Unset, str]): Id of the group the dataset belongs to
        name (Union[None, Unset, str]): Name of dataset
        priority (Union[None, Unset, int]): Numeric value representing priority of the dataset within its `data_type`
        units (Union[None, Unset, str]): Units for the values in the dataset
    """

    format_: MatrixDatasetUpdateParamsFormat
    data_type: Union[None, Unset, str] = UNSET
    dataset_metadata: Union[
        "MatrixDatasetUpdateParamsDatasetMetadataType0", None, Unset
    ] = UNSET
    group_id: Union[None, Unset, str] = UNSET
    name: Union[None, Unset, str] = UNSET
    priority: Union[None, Unset, int] = UNSET
    units: Union[None, Unset, str] = UNSET
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

        units: Union[None, Unset, str]
        if isinstance(self.units, Unset):
            units = UNSET
        else:
            units = self.units

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
        if group_id is not UNSET:
            field_dict["group_id"] = group_id
        if name is not UNSET:
            field_dict["name"] = name
        if priority is not UNSET:
            field_dict["priority"] = priority
        if units is not UNSET:
            field_dict["units"] = units

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

        def _parse_units(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        units = _parse_units(d.pop("units", UNSET))

        matrix_dataset_update_params = cls(
            format_=format_,
            data_type=data_type,
            dataset_metadata=dataset_metadata,
            group_id=group_id,
            name=name,
            priority=priority,
            units=units,
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
