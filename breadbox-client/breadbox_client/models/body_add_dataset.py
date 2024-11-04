from io import BytesIO
from typing import Any, Dict, List, Tuple, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.value_type import ValueType
from ..types import UNSET, File, Unset

T = TypeVar("T", bound="BodyAddDataset")


@_attrs_define
class BodyAddDataset:
    """
    Attributes:
        data_file (File): CSV file of your dataset with feature ids as columns and sample ids as rows.
        data_type (str): Data type grouping for your dataset
        is_transient (bool): Transient datasets can be deleted - should only be set to true for non-public short-term-
            use datasets like custom analysis results.
        name (str): Name of dataset, used for display
        sample_type (str): Type of samples your dataset contains
        units (str): Units for the values in the dataset, used for display
        value_type (ValueType):
        dataset_metadata (Union[None, Unset, str]): Contains a dictionary of additional dataset values that are not
            already provided above.
        feature_type (Union[Unset, str]): Type of features your dataset contains
        group_id (Union[Unset, str]): ID of the group the dataset belongs to. Required for non-transient datasets. The
            public group is `00000000-0000-0000-0000-000000000000`.
        priority (Union[Unset, int]): Numeric value assigned to the dataset with `1` being highest priority within the
            `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.
        taiga_id (Union[Unset, str]): Taiga ID the dataset is sourced from.
    """

    data_file: File
    data_type: str
    is_transient: bool
    name: str
    sample_type: str
    units: str
    value_type: ValueType
    dataset_metadata: Union[None, Unset, str] = UNSET
    feature_type: Union[Unset, str] = UNSET
    group_id: Union[Unset, str] = UNSET
    priority: Union[Unset, int] = UNSET
    taiga_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data_file = self.data_file.to_tuple()

        data_type = self.data_type

        is_transient = self.is_transient

        name = self.name

        sample_type = self.sample_type

        units = self.units

        value_type = self.value_type.value

        dataset_metadata: Union[None, Unset, str]
        if isinstance(self.dataset_metadata, Unset):
            dataset_metadata = UNSET
        else:
            dataset_metadata = self.dataset_metadata

        feature_type = self.feature_type

        group_id = self.group_id

        priority = self.priority

        taiga_id = self.taiga_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "data_file": data_file,
                "data_type": data_type,
                "is_transient": is_transient,
                "name": name,
                "sample_type": sample_type,
                "units": units,
                "value_type": value_type,
            }
        )
        if dataset_metadata is not UNSET:
            field_dict["dataset_metadata"] = dataset_metadata
        if feature_type is not UNSET:
            field_dict["feature_type"] = feature_type
        if group_id is not UNSET:
            field_dict["group_id"] = group_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    def to_multipart(self) -> Dict[str, Any]:
        data_file = self.data_file.to_tuple()

        data_type = (None, str(self.data_type).encode(), "text/plain")

        is_transient = (None, str(self.is_transient).encode(), "text/plain")

        name = (None, str(self.name).encode(), "text/plain")

        sample_type = (None, str(self.sample_type).encode(), "text/plain")

        units = (None, str(self.units).encode(), "text/plain")

        value_type = (None, str(self.value_type.value).encode(), "text/plain")

        dataset_metadata: Union[Tuple[None, bytes, str], Unset]

        if isinstance(self.dataset_metadata, Unset):
            dataset_metadata = UNSET
        elif isinstance(self.dataset_metadata, str):
            dataset_metadata = (None, str(self.dataset_metadata).encode(), "text/plain")
        else:
            dataset_metadata = (None, str(self.dataset_metadata).encode(), "text/plain")

        feature_type = (
            self.feature_type
            if isinstance(self.feature_type, Unset)
            else (None, str(self.feature_type).encode(), "text/plain")
        )

        group_id = (
            self.group_id
            if isinstance(self.group_id, Unset)
            else (None, str(self.group_id).encode(), "text/plain")
        )

        priority = (
            self.priority
            if isinstance(self.priority, Unset)
            else (None, str(self.priority).encode(), "text/plain")
        )

        taiga_id = (
            self.taiga_id
            if isinstance(self.taiga_id, Unset)
            else (None, str(self.taiga_id).encode(), "text/plain")
        )

        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = (None, str(prop).encode(), "text/plain")

        field_dict.update(
            {
                "data_file": data_file,
                "data_type": data_type,
                "is_transient": is_transient,
                "name": name,
                "sample_type": sample_type,
                "units": units,
                "value_type": value_type,
            }
        )
        if dataset_metadata is not UNSET:
            field_dict["dataset_metadata"] = dataset_metadata
        if feature_type is not UNSET:
            field_dict["feature_type"] = feature_type
        if group_id is not UNSET:
            field_dict["group_id"] = group_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        data_file = File(payload=BytesIO(d.pop("data_file")))

        data_type = d.pop("data_type")

        is_transient = d.pop("is_transient")

        name = d.pop("name")

        sample_type = d.pop("sample_type")

        units = d.pop("units")

        value_type = ValueType(d.pop("value_type"))

        def _parse_dataset_metadata(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        dataset_metadata = _parse_dataset_metadata(d.pop("dataset_metadata", UNSET))

        feature_type = d.pop("feature_type", UNSET)

        group_id = d.pop("group_id", UNSET)

        priority = d.pop("priority", UNSET)

        taiga_id = d.pop("taiga_id", UNSET)

        body_add_dataset = cls(
            data_file=data_file,
            data_type=data_type,
            is_transient=is_transient,
            name=name,
            sample_type=sample_type,
            units=units,
            value_type=value_type,
            dataset_metadata=dataset_metadata,
            feature_type=feature_type,
            group_id=group_id,
            priority=priority,
            taiga_id=taiga_id,
        )

        body_add_dataset.additional_properties = d
        return body_add_dataset

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
