import json
from io import BytesIO
from typing import Any, Dict, List, Tuple, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, File, Unset

T = TypeVar("T", bound="BodyUpdateFeatureTypeMetadata")


@_attrs_define
class BodyUpdateFeatureTypeMetadata:
    """
    Attributes:
        metadata_file (File):
        annotation_type_mapping (Union[None, Unset, str]):
        id_mapping (Union[None, Unset, str]): A mapping of dataset column names to the feature type name those columns
            reference.
        properties_to_index (Union[Unset, List[str]]): A list of columns by name to add to the dimension search index.
        taiga_id (Union[Unset, str]):
    """

    metadata_file: File
    annotation_type_mapping: Union[None, Unset, str] = UNSET
    id_mapping: Union[None, Unset, str] = UNSET
    properties_to_index: Union[Unset, List[str]] = UNSET
    taiga_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        metadata_file = self.metadata_file.to_tuple()

        annotation_type_mapping: Union[None, Unset, str]
        if isinstance(self.annotation_type_mapping, Unset):
            annotation_type_mapping = UNSET
        else:
            annotation_type_mapping = self.annotation_type_mapping

        id_mapping: Union[None, Unset, str]
        if isinstance(self.id_mapping, Unset):
            id_mapping = UNSET
        else:
            id_mapping = self.id_mapping

        properties_to_index: Union[Unset, List[str]] = UNSET
        if not isinstance(self.properties_to_index, Unset):
            properties_to_index = self.properties_to_index

        taiga_id = self.taiga_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "metadata_file": metadata_file,
            }
        )
        if annotation_type_mapping is not UNSET:
            field_dict["annotation_type_mapping"] = annotation_type_mapping
        if id_mapping is not UNSET:
            field_dict["id_mapping"] = id_mapping
        if properties_to_index is not UNSET:
            field_dict["properties_to_index"] = properties_to_index
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    def to_multipart(self) -> Dict[str, Any]:
        metadata_file = self.metadata_file.to_tuple()

        annotation_type_mapping: Union[Tuple[None, bytes, str], Unset]

        if isinstance(self.annotation_type_mapping, Unset):
            annotation_type_mapping = UNSET
        elif isinstance(self.annotation_type_mapping, str):
            annotation_type_mapping = (
                None,
                str(self.annotation_type_mapping).encode(),
                "text/plain",
            )
        else:
            annotation_type_mapping = (
                None,
                str(self.annotation_type_mapping).encode(),
                "text/plain",
            )

        id_mapping: Union[Tuple[None, bytes, str], Unset]

        if isinstance(self.id_mapping, Unset):
            id_mapping = UNSET
        elif isinstance(self.id_mapping, str):
            id_mapping = (None, str(self.id_mapping).encode(), "text/plain")
        else:
            id_mapping = (None, str(self.id_mapping).encode(), "text/plain")

        properties_to_index: Union[Unset, Tuple[None, bytes, str]] = UNSET
        if not isinstance(self.properties_to_index, Unset):
            _temp_properties_to_index = self.properties_to_index
            properties_to_index = (
                None,
                json.dumps(_temp_properties_to_index).encode(),
                "application/json",
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
                "metadata_file": metadata_file,
            }
        )
        if annotation_type_mapping is not UNSET:
            field_dict["annotation_type_mapping"] = annotation_type_mapping
        if id_mapping is not UNSET:
            field_dict["id_mapping"] = id_mapping
        if properties_to_index is not UNSET:
            field_dict["properties_to_index"] = properties_to_index
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        metadata_file = File(payload=BytesIO(d.pop("metadata_file")))

        def _parse_annotation_type_mapping(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        annotation_type_mapping = _parse_annotation_type_mapping(
            d.pop("annotation_type_mapping", UNSET)
        )

        def _parse_id_mapping(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        id_mapping = _parse_id_mapping(d.pop("id_mapping", UNSET))

        properties_to_index = cast(List[str], d.pop("properties_to_index", UNSET))

        taiga_id = d.pop("taiga_id", UNSET)

        body_update_feature_type_metadata = cls(
            metadata_file=metadata_file,
            annotation_type_mapping=annotation_type_mapping,
            id_mapping=id_mapping,
            properties_to_index=properties_to_index,
            taiga_id=taiga_id,
        )

        body_update_feature_type_metadata.additional_properties = d
        return body_update_feature_type_metadata

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
