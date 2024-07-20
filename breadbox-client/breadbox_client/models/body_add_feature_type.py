import json
from io import BytesIO
from typing import (
    Any,
    Dict,
    List,
    Tuple,
    Type,
    TypeVar,
    Union,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, File, FileJsonType, Unset

T = TypeVar("T", bound="BodyAddFeatureType")


@_attrs_define
class BodyAddFeatureType:
    """
    Attributes:
        id_column (str):
        name (str):
        annotation_type_mapping (Union[None, Unset, str]):
        id_mapping (Union[None, Unset, str]): A mapping of dataset column names to the feature type name those columns
            reference.
        metadata_file (Union[File, None, Unset]):
        properties_to_index (Union[Unset, List[str]]): A list of columns by name to add to the dimension search index.
        taiga_id (Union[None, Unset, str]):
    """

    id_column: str
    name: str
    annotation_type_mapping: Union[None, Unset, str] = UNSET
    id_mapping: Union[None, Unset, str] = UNSET
    metadata_file: Union[File, None, Unset] = UNSET
    properties_to_index: Union[Unset, List[str]] = UNSET
    taiga_id: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id_column = self.id_column

        name = self.name

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

        metadata_file: Union[FileJsonType, None, Unset]
        if isinstance(self.metadata_file, Unset):
            metadata_file = UNSET
        elif isinstance(self.metadata_file, File):
            metadata_file = self.metadata_file.to_tuple()

        else:
            metadata_file = self.metadata_file

        properties_to_index: Union[Unset, List[str]] = UNSET
        if not isinstance(self.properties_to_index, Unset):
            properties_to_index = self.properties_to_index

        taiga_id: Union[None, Unset, str]
        if isinstance(self.taiga_id, Unset):
            taiga_id = UNSET
        else:
            taiga_id = self.taiga_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id_column": id_column,
                "name": name,
            }
        )
        if annotation_type_mapping is not UNSET:
            field_dict["annotation_type_mapping"] = annotation_type_mapping
        if id_mapping is not UNSET:
            field_dict["id_mapping"] = id_mapping
        if metadata_file is not UNSET:
            field_dict["metadata_file"] = metadata_file
        if properties_to_index is not UNSET:
            field_dict["properties_to_index"] = properties_to_index
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    def to_multipart(self) -> Dict[str, Any]:
        id_column = (None, str(self.id_column).encode(), "text/plain")

        name = (None, str(self.name).encode(), "text/plain")

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

        metadata_file: Union[Tuple[None, bytes, str], Unset]

        if isinstance(self.metadata_file, Unset):
            metadata_file = UNSET
        elif isinstance(self.metadata_file, File):
            metadata_file = self.metadata_file.to_tuple()
        else:
            metadata_file = (None, str(self.metadata_file).encode(), "text/plain")

        properties_to_index: Union[Unset, Tuple[None, bytes, str]] = UNSET
        if not isinstance(self.properties_to_index, Unset):
            _temp_properties_to_index = self.properties_to_index
            properties_to_index = (
                None,
                json.dumps(_temp_properties_to_index).encode(),
                "application/json",
            )

        taiga_id: Union[Tuple[None, bytes, str], Unset]

        if isinstance(self.taiga_id, Unset):
            taiga_id = UNSET
        elif isinstance(self.taiga_id, str):
            taiga_id = (None, str(self.taiga_id).encode(), "text/plain")
        else:
            taiga_id = (None, str(self.taiga_id).encode(), "text/plain")

        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = (None, str(prop).encode(), "text/plain")

        field_dict.update(
            {
                "id_column": id_column,
                "name": name,
            }
        )
        if annotation_type_mapping is not UNSET:
            field_dict["annotation_type_mapping"] = annotation_type_mapping
        if id_mapping is not UNSET:
            field_dict["id_mapping"] = id_mapping
        if metadata_file is not UNSET:
            field_dict["metadata_file"] = metadata_file
        if properties_to_index is not UNSET:
            field_dict["properties_to_index"] = properties_to_index
        if taiga_id is not UNSET:
            field_dict["taiga_id"] = taiga_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id_column = d.pop("id_column")

        name = d.pop("name")

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

        def _parse_metadata_file(data: object) -> Union[File, None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, bytes):
                    raise TypeError()
                metadata_file_type_0 = File(payload=BytesIO(data))

                return metadata_file_type_0
            except:  # noqa: E722
                pass
            return cast(Union[File, None, Unset], data)

        metadata_file = _parse_metadata_file(d.pop("metadata_file", UNSET))

        properties_to_index = cast(List[str], d.pop("properties_to_index", UNSET))

        def _parse_taiga_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        taiga_id = _parse_taiga_id(d.pop("taiga_id", UNSET))

        body_add_feature_type = cls(
            id_column=id_column,
            name=name,
            annotation_type_mapping=annotation_type_mapping,
            id_mapping=id_mapping,
            metadata_file=metadata_file,
            properties_to_index=properties_to_index,
            taiga_id=taiga_id,
        )

        body_add_feature_type.additional_properties = d
        return body_add_feature_type

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
