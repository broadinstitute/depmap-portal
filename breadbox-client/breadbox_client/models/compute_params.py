from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ComputeParams")


@_attrs_define
class ComputeParams:
    """
    Attributes:
        analysis_type (str):
        dataset_id (str):
        query_cell_lines (Union[List[str], None, Unset]):
        query_dataset_id (Union[None, Unset, str]):
        query_feature_id (Union[None, Unset, str]):
        query_id (Union[None, Unset, str]):
        query_values (Union[List[Any], None, Unset]):
        vector_variable_type (Union[None, Unset, str]):
    """

    analysis_type: str
    dataset_id: str
    query_cell_lines: Union[List[str], None, Unset] = UNSET
    query_dataset_id: Union[None, Unset, str] = UNSET
    query_feature_id: Union[None, Unset, str] = UNSET
    query_id: Union[None, Unset, str] = UNSET
    query_values: Union[List[Any], None, Unset] = UNSET
    vector_variable_type: Union[None, Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        analysis_type = self.analysis_type

        dataset_id = self.dataset_id

        query_cell_lines: Union[List[str], None, Unset]
        if isinstance(self.query_cell_lines, Unset):
            query_cell_lines = UNSET
        elif isinstance(self.query_cell_lines, list):
            query_cell_lines = self.query_cell_lines

        else:
            query_cell_lines = self.query_cell_lines

        query_dataset_id: Union[None, Unset, str]
        if isinstance(self.query_dataset_id, Unset):
            query_dataset_id = UNSET
        else:
            query_dataset_id = self.query_dataset_id

        query_feature_id: Union[None, Unset, str]
        if isinstance(self.query_feature_id, Unset):
            query_feature_id = UNSET
        else:
            query_feature_id = self.query_feature_id

        query_id: Union[None, Unset, str]
        if isinstance(self.query_id, Unset):
            query_id = UNSET
        else:
            query_id = self.query_id

        query_values: Union[List[Any], None, Unset]
        if isinstance(self.query_values, Unset):
            query_values = UNSET
        elif isinstance(self.query_values, list):
            query_values = self.query_values

        else:
            query_values = self.query_values

        vector_variable_type: Union[None, Unset, str]
        if isinstance(self.vector_variable_type, Unset):
            vector_variable_type = UNSET
        else:
            vector_variable_type = self.vector_variable_type

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "analysisType": analysis_type,
                "datasetId": dataset_id,
            }
        )
        if query_cell_lines is not UNSET:
            field_dict["queryCellLines"] = query_cell_lines
        if query_dataset_id is not UNSET:
            field_dict["queryDatasetId"] = query_dataset_id
        if query_feature_id is not UNSET:
            field_dict["queryFeatureId"] = query_feature_id
        if query_id is not UNSET:
            field_dict["queryId"] = query_id
        if query_values is not UNSET:
            field_dict["queryValues"] = query_values
        if vector_variable_type is not UNSET:
            field_dict["vectorVariableType"] = vector_variable_type

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        analysis_type = d.pop("analysisType")

        dataset_id = d.pop("datasetId")

        def _parse_query_cell_lines(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                query_cell_lines_type_0 = cast(List[str], data)

                return query_cell_lines_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        query_cell_lines = _parse_query_cell_lines(d.pop("queryCellLines", UNSET))

        def _parse_query_dataset_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        query_dataset_id = _parse_query_dataset_id(d.pop("queryDatasetId", UNSET))

        def _parse_query_feature_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        query_feature_id = _parse_query_feature_id(d.pop("queryFeatureId", UNSET))

        def _parse_query_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        query_id = _parse_query_id(d.pop("queryId", UNSET))

        def _parse_query_values(data: object) -> Union[List[Any], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                query_values_type_0 = cast(List[Any], data)

                return query_values_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[Any], None, Unset], data)

        query_values = _parse_query_values(d.pop("queryValues", UNSET))

        def _parse_vector_variable_type(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        vector_variable_type = _parse_vector_variable_type(
            d.pop("vectorVariableType", UNSET)
        )

        compute_params = cls(
            analysis_type=analysis_type,
            dataset_id=dataset_id,
            query_cell_lines=query_cell_lines,
            query_dataset_id=query_dataset_id,
            query_feature_id=query_feature_id,
            query_id=query_id,
            query_values=query_values,
            vector_variable_type=vector_variable_type,
        )

        compute_params.additional_properties = d
        return compute_params

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
