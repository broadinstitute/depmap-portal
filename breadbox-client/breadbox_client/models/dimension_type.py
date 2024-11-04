from typing import (
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

from ..models.dimension_type_axis import DimensionTypeAxis
from ..types import UNSET, Unset

T = TypeVar("T", bound="DimensionType")


@_attrs_define
class DimensionType:
    """
    Attributes:
        axis (DimensionTypeAxis):
        display_name (str):
        id_column (str):
        name (str):
        metadata_dataset_id (Union[None, Unset, str]):
        properties_to_index (Union[List[str], None, Unset]):
    """

    axis: DimensionTypeAxis
    display_name: str
    id_column: str
    name: str
    metadata_dataset_id: Union[None, Unset, str] = UNSET
    properties_to_index: Union[List[str], None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        axis = self.axis.value

        display_name = self.display_name

        id_column = self.id_column

        name = self.name

        metadata_dataset_id: Union[None, Unset, str]
        if isinstance(self.metadata_dataset_id, Unset):
            metadata_dataset_id = UNSET
        else:
            metadata_dataset_id = self.metadata_dataset_id

        properties_to_index: Union[List[str], None, Unset]
        if isinstance(self.properties_to_index, Unset):
            properties_to_index = UNSET
        elif isinstance(self.properties_to_index, list):
            properties_to_index = self.properties_to_index

        else:
            properties_to_index = self.properties_to_index

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "axis": axis,
                "display_name": display_name,
                "id_column": id_column,
                "name": name,
            }
        )
        if metadata_dataset_id is not UNSET:
            field_dict["metadata_dataset_id"] = metadata_dataset_id
        if properties_to_index is not UNSET:
            field_dict["properties_to_index"] = properties_to_index

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        axis = DimensionTypeAxis(d.pop("axis"))

        display_name = d.pop("display_name")

        id_column = d.pop("id_column")

        name = d.pop("name")

        def _parse_metadata_dataset_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        metadata_dataset_id = _parse_metadata_dataset_id(
            d.pop("metadata_dataset_id", UNSET)
        )

        def _parse_properties_to_index(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                properties_to_index_type_0 = cast(List[str], data)

                return properties_to_index_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        properties_to_index = _parse_properties_to_index(
            d.pop("properties_to_index", UNSET)
        )

        dimension_type = cls(
            axis=axis,
            display_name=display_name,
            id_column=id_column,
            name=name,
            metadata_dataset_id=metadata_dataset_id,
            properties_to_index=properties_to_index,
        )

        dimension_type.additional_properties = d
        return dimension_type

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
