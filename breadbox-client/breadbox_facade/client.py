import base64
from datetime import date, datetime
import hashlib
import io

import typing
from dataclasses import dataclass
from time import sleep, time
from typing import Any, Dict, List, Literal, Optional, Union, IO
from uuid import UUID

import pandas as pd

from breadbox_client import Client
from breadbox_client.api.health_check import ok
from breadbox_client.api.api import get_task_status as get_task_status_client
from breadbox_client.api.compute import compute_univariate_associations as compute_univariate_associations_client
from breadbox_client.api.data_types import add_data_type as add_data_type_client
from breadbox_client.api.data_types import get_data_types as get_data_types_client
from breadbox_client.api.data_types import remove_data_type as remove_data_type_client
from breadbox_client.api.datasets import add_dataset_uploads as add_dataset_uploads_client
from breadbox_client.api.datasets import get_dataset as get_dataset_client
from breadbox_client.api.datasets import get_dataset_data as get_dataset_data_client
from breadbox_client.api.datasets import get_tabular_dataset_data as get_tabular_dataset_data_client
from breadbox_client.api.datasets import get_matrix_dataset_data as get_matrix_dataset_data_client
from breadbox_client.api.datasets import get_dataset_features as get_dataset_features_client
from breadbox_client.api.datasets import get_dataset_samples as get_dataset_samples_client
from breadbox_client.api.datasets import get_datasets as get_datasets_client
from breadbox_client.api.datasets import get_feature_data as get_feature_data_client
from breadbox_client.api.datasets import remove_dataset as remove_dataset_client
from breadbox_client.api.datasets import update_dataset as update_dataset_client
from breadbox_client.api.default import upload_file
from breadbox_client.api.groups import add_group as add_group_client
from breadbox_client.api.groups import add_group_entry as add_group_entry_client
from breadbox_client.api.groups import remove_group_access as remove_group_access_client
from breadbox_client.api.groups import get_groups as get_groups_client
from breadbox_client.api.types import add_dimension_type as add_dimension_type_client
from breadbox_client.api.types import get_dimension_type as get_dimension_type_client
from breadbox_client.api.types import get_dimension_types as get_dimension_types_client
from breadbox_client.api.types import get_dimension_type_identifiers as get_dimension_type_identifiers_client
from breadbox_client.api.types import get_feature_types as get_feature_types_client
from breadbox_client.api.types import get_sample_types as get_sample_types_client
from breadbox_client.api.types import remove_dimension_type as remove_dimension_type_client
from breadbox_client.api.types import update_dimension_type as update_dimension_type_client
from breadbox_client.api.temp import get_associations as get_associations_client
from breadbox_client.api.temp import add_associations as add_associations_client
from breadbox_client.api.temp import get_associations_for_slice as get_associations_for_slice_client
from breadbox_client.api.temp import evaluate_context as evaluate_context_client
from breadbox_client.api.temp import get_sql_schema
from breadbox_client.api.temp import query_sql
from breadbox_client.api.temp import get_all_predictive_model_results as get_all_predictive_model_results_client
from breadbox_client.api.temp import get_all_predictive_model_configs as get_all_predictive_model_configs_client
from breadbox_client.api.temp import get_predictive_model_configs_for_dimension_type as get_predictive_model_configs_for_dimension_type_client
from breadbox_client.api.temp import create_predictive_model_configs as create_predictive_model_configs_client
from breadbox_client.api.temp import update_predictive_model_configs as update_predictive_model_configs_client
from breadbox_client.api.temp import delete_predictive_model_configs as delete_predictive_model_configs_client
from breadbox_client.api.temp import get_predictive_models_for_feature as get_predictive_models_for_feature_client
from breadbox_client.api.temp import bulk_load_predictive_model_results as bulk_load_predictive_model_results_client
from breadbox_client.api.temp import delete_predictive_model_results as delete_predictive_model_results_client
from breadbox_client.api.release_versions import get_release_versions as get_release_versions_client
from breadbox_client.api.release_versions import get_release_version as get_release_version_client
from breadbox_client.api.release_versions import create_release_version as create_release_version_client
from breadbox_client.api.release_versions import delete_release_version as delete_release_version_client

from breadbox_client.models import (
    AccessType,
    AddDatasetResponse,
    AddDimensionType,
    Associations,
    AssociationTable,
    AssociationsIn,
    AssociationsInAxis,
    AddDimensionTypeAxis,
    BodyAddDataType,
    BodyGetDatasetData,
    BodyUploadFile,
    ColumnMetadata,
    ComputeParams,
    ComputeResponse,
    Context,
    ContextMatchResponse,
    DataType,
    DimensionIdentifiers, 
    DimensionType,
    FeatureSampleIdentifier,
    FeatureResponse,
    FeatureTypeOut,
    GroupIn,
    GroupEntry,
    GroupEntryIn,
    GroupOut,
    MatrixDatasetParams,
    MatrixDatasetParamsDatasetMetadataType0,
    MatrixDatasetUpdateParamsDatasetMetadataType0,
    MatrixDatasetResponse,
    MatrixDimensionsInfo,
    SampleTypeOut,
    SliceQuery,
    BodyGetAssociationsForSlice,
    SliceQueryIdentifierType,
    SqlQuery,
    TableDatasetParams,
    TableDatasetParamsColumnsMetadata,
    TableDatasetParamsDatasetMetadataType0,
    TabularDatasetUpdateParamsDatasetMetadataType0,
    TabularDatasetResponse,
    TabularDimensionsInfo,
    UpdateDimensionType,
    UploadFileResponse,
    ValueType,
    MatrixDatasetParamsDataFileFormat,
    BulkLoadResultsIn,
    ModelConfigIn,
    PredictiveModelConfigIn,
    PredictiveModelConfigOut,
    PredictiveModelResultOut,
    PredictiveModelsResponse,
    ReleaseVersionResponse,
    CreateReleaseVersionParams, 
    ReleaseVersionResponse
)

from breadbox_client.types import UNSET, Unset, File, Response
from breadbox_facade.exceptions import BreadboxException


class TimeoutError(Exception):
    pass


# These methods largely maps onto a breadbox endpoint. These are defined here to make it easier to interact with breadbox through the client.
# Nothing here should be referenced outside of the data_access and breadbox_shim modules.


@dataclass
class UploadedFile:
    md5: str
    file_ids: List[str]


class BBClient:
    PUBLIC_GROUP_ID = str(UUID("00000000-0000-0000-0000-000000000000"))
    TRANSIENT_GROUP_ID = str(UUID("11111111-1111-1111-1111-111111111111"))

    def __init__(self, base_url: str, user: str, password: Optional[str] = None):
        """
        Instantiate a client which can make requests to breadbox.

        If a proxy_password is provided, then basic authentication will be used. 
        This is only necessary for non-public environments. 
        """
        headers = {"X-Forwarded-User": user, "X-Forwarded-Email": user}

        # If a password is provided, add an authorization header
        if password is not None:
            auth_string_bytes = f"{user}:{password}".encode('utf-8')
            encoded_credentials = base64.b64encode(auth_string_bytes).decode("utf-8")
            headers["Authorization"] = f"Basic {encoded_credentials}"

        autogenerated_client = Client(
            base_url,
            raise_on_unexpected_status=True,
        ).with_headers(headers)
        self.client = autogenerated_client

    def _parse_client_response(self, response: Response[Any]) -> Any:
        """
        If the breadbox client returns a non-200 response, propogate that response code
        instead of throwing an internal server error.
        """
        if response.status_code < 200 or response.status_code >= 300:
            raise BreadboxException(response.status_code, response.parsed)
        else:
            return response.parsed

    # DATASETS

    def get_dataset(
        self,
        dataset_id: str,
    ) -> Union[MatrixDatasetResponse, TabularDatasetResponse]:
        """Get metadata for a dataset, if it exists and is available to the user."""
        breadbox_response = get_dataset_client.sync_detailed(dataset_id=dataset_id, client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_datasets(
        self,
        feature_id: Optional[str] = None,
        feature_type: Optional[str] = None,
        sample_id: Optional[str] = None,
        sample_type: Optional[str] = None,
        value_type: Optional[str] = None,
    ) -> list[Union[MatrixDatasetResponse, TabularDatasetResponse]]:
        """Get metadata for all datasets available to current user."""
        breadbox_response = get_datasets_client.sync_detailed(
            client=self.client,
            feature_id=feature_id if feature_id else UNSET,
            feature_type=feature_type if feature_type else UNSET,
            sample_id=sample_id if sample_id else UNSET,
            sample_type=sample_type if sample_type else UNSET,
            value_type=ValueType(value_type) if value_type else UNSET,
            )
        return self._parse_client_response(breadbox_response)

    def remove_dataset(self, dataset_id: str):
        breadbox_response = remove_dataset_client.sync_detailed(dataset_id=dataset_id, client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_dataset_data(
        self,
        dataset_id: str,
        features: Optional[list[str]],
        feature_identifier: Optional[Literal["id", "label"]],
        samples: Optional[list[str]],
        sample_identifier: Optional[Literal["id", "label"]],
    ) -> pd.DataFrame:
        """DEPRECATED: Use get_tabular_dataset_data or get_matrix_dataset_data instead."""
        request_params = BodyGetDatasetData.from_dict(
            dict(
                features=features,
                feature_identifier=feature_identifier if feature_identifier else UNSET,
                samples=samples,
                sample_identifier=sample_identifier if sample_identifier else UNSET,
            )
        )
        breadbox_response = get_dataset_data_client.sync_detailed(
            dataset_id=dataset_id,
            client=self.client,
            body=request_params,
        )
        response = self._parse_client_response(breadbox_response)
        try:
            return pd.DataFrame.from_dict(response)
        except Exception as e:
            raise Exception(e, "Unable to parse breadbox response into dataframe.")
        
    def get_tabular_dataset_data(
        self, 
        dataset_id: str,
        columns: Optional[list[str]] = None,
        identifier: Optional[Literal["id", "label"]] = None,
        indices: Optional[list[str]] = None,
        strict: bool = False,
    ):
        request_params = TabularDimensionsInfo(
            columns=columns,
            identifier=FeatureSampleIdentifier(identifier) if identifier else UNSET,
            indices=indices,
        )
        breadbox_response = get_tabular_dataset_data_client.sync_detailed(
            dataset_id=dataset_id,
            client=self.client,
            body=request_params,
            strict=strict,
        )
        response = self._parse_client_response(breadbox_response)
        try:
            return pd.DataFrame.from_dict(response)
        except Exception as e:
            raise Exception(e, "Unable to parse breadbox response into dataframe.")

    def get_matrix_dataset_data(
        self, 
        dataset_id: str,
        features: Optional[list[str]] = None,
        feature_identifier: Optional[Literal["id", "label"]] = None,
        samples: Optional[list[str]] = None,
        sample_identifier: Optional[Literal["id", "label"]] = None,
        strict = False,
    ):
        request_params = MatrixDimensionsInfo(
            feature_identifier=FeatureSampleIdentifier(feature_identifier) if feature_identifier else UNSET,
            features=features,
            sample_identifier=FeatureSampleIdentifier(sample_identifier) if sample_identifier else UNSET,
            samples=samples,
        )
        breadbox_response = get_matrix_dataset_data_client.sync_detailed(
            dataset_id=dataset_id,
            client=self.client,
            body=request_params,
            strict=strict,
        )
        response = self._parse_client_response(breadbox_response)
        try:
            return pd.DataFrame.from_dict(response)
        except Exception as e:
            raise Exception(e, "Unable to parse breadbox response into dataframe.")


    def get_dataset_features(self, dataset_id: str) -> list[dict[str, str]]:
        """Get information about each feature belonging to a given dataset."""
        breadbox_response = get_dataset_features_client.sync_detailed(dataset_id=dataset_id, client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_dataset_samples(self, dataset_id: str) -> list[dict[str, str]]:
        breadbox_response = get_dataset_samples_client.sync_detailed(dataset_id=dataset_id, client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_feature_data(self, dataset_ids: list[str], feature_ids: list[str]) -> list[FeatureResponse]:
        """Get the column data values for a given set of features."""
        breadbox_response = get_feature_data_client.sync_detailed(
            client=self.client,
            dataset_ids=dataset_ids,
            feature_ids=feature_ids,
        )
        return self._parse_client_response(breadbox_response)

    def upload_file(self, file_handle: IO[bytes], chunk_size=5 * 1024 * 1024) -> UploadedFile:
        "Uploads a file in pieces and returns a list of file IDs and MD5 hash for subsequent calls"

        md5_hash = hashlib.md5()

        file_ids = []
        while True:
            chunk = file_handle.read(chunk_size)
            if len(chunk) == 0:
                break

            md5_hash.update(chunk)

            breadbox_response = upload_file.sync_detailed(
                client=self.client,
                body=BodyUploadFile(
                    file=File(
                        payload=io.BytesIO(chunk),
                        file_name="unnamed"
                    )
                ),
            )

            response: UploadFileResponse = typing.cast(
                UploadFileResponse, self._parse_client_response(breadbox_response)
            )
            file_ids.append(response.file_id)
        return UploadedFile(md5=md5_hash.hexdigest(), file_ids=file_ids)

    def add_table_dataset(
        self,
        name: str,
        group_id: str,
        index_type: str,
        data_df: pd.DataFrame,
        data_type: str,
        columns_metadata: Dict[str, ColumnMetadata],
        is_transient: bool = False,
        dataset_metadata: Optional[Dict] = None,
        priority: Optional[int] = None,
        taiga_id: Optional[str] = None,
        given_id: Optional[str] = None,
        timeout=None,
        description=None,
    ):
        metadata = TableDatasetParamsDatasetMetadataType0.from_dict(dataset_metadata) if dataset_metadata else None

        uploaded_file = self.upload_file(file_handle=io.BytesIO(data_df.to_csv(index=False).encode("utf8")))

        # convert types the only way I know how to construct TableDatasetParamsColumnsMetadata
        constructed_column_metadata = TableDatasetParamsColumnsMetadata.from_dict(
            {name: columns_metadata[name].to_dict() for name in columns_metadata}
        )

        params = TableDatasetParams(
            columns_metadata=constructed_column_metadata,
            data_type=data_type,
            dataset_md5=uploaded_file.md5,
            file_ids=uploaded_file.file_ids,
            format_="tabular",
            group_id=group_id,
            index_type=index_type,
            name=name,
            dataset_metadata=metadata,
            is_transient=is_transient,
            priority=priority if priority else UNSET,
            taiga_id=taiga_id if taiga_id else UNSET,
            given_id=given_id if given_id else UNSET,
            description=description if description else UNSET,
        )
        breadbox_response = add_dataset_uploads_client.sync_detailed(
            client=self.client,
            body=params,
        )
        breadbox_response_ = typing.cast(AddDatasetResponse, self._parse_client_response(breadbox_response))
        result = self.await_task_result(breadbox_response_.id, timeout=timeout)
        return result

    def add_matrix_dataset(
        self,
        name: str,
        units: str,
        data_type: str,
        feature_type: Optional[str],
        sample_type: str,
        *,
        data_df: Optional[pd.DataFrame] = None,
        data_file_name : Optional[str] = None,
        data_file_format: Optional[Literal["parquet", "csv", "hdf5"]]=None,
        is_transient: bool = False,
        group_id: str = PUBLIC_GROUP_ID,
        value_type: str = ValueType.CONTINUOUS.value,
        allowed_values: Optional[List[str]] = None,
        priority: Optional[int] = None,
        taiga_id: Optional[str] = None,
        given_id: Optional[str] = None,
        dataset_metadata: Optional[dict] = None,
        timeout=None,
        log_status=lambda msg: None,
        description:Optional[str] = None,
    ) -> AddDatasetResponse:
        log_status(f"add_matrix_dataset start")
        metadata = MatrixDatasetParamsDatasetMetadataType0.from_dict(dataset_metadata) if dataset_metadata else None

        if data_file_name is not None:
            assert data_file_format is not None, "If data_filename is specified, then also specify data_file_format"
            assert data_df is None, "Cannot have both data_filename and data_df not None"
            # okay, we're uploading a file
            with open(data_file_name, "rb") as f:
                uploaded_file = self.upload_file(f)
        else:
            assert data_df is not None, "If data_filename is not specified, data_df must be"
            assert data_file_format is None, "if data_filename is not specified, data_file_format must also be provided"
            log_status("Writing CSV")
            buffer = io.BytesIO(data_df.to_csv(index=False).encode("utf8"))
            log_status(f"Uploading CSV")
            uploaded_file = self.upload_file(file_handle=buffer)
            data_file_format="csv"

        params = MatrixDatasetParams(
            name=name,
            data_type=data_type,
            dataset_md5=uploaded_file.md5,
            file_ids=uploaded_file.file_ids,
            format_="matrix",
            group_id=group_id,
            sample_type=sample_type,
            units=units,
            value_type=ValueType(value_type),
            allowed_values=allowed_values if allowed_values else UNSET,
            dataset_metadata=metadata,
            feature_type=feature_type if feature_type else UNSET,
            is_transient=is_transient,
            priority=priority if priority else UNSET,
            taiga_id=taiga_id if taiga_id else UNSET,
            given_id=given_id if given_id else UNSET,
            data_file_format=({"csv": MatrixDatasetParamsDataFileFormat.CSV, 
            "parquet": MatrixDatasetParamsDataFileFormat.PARQUET, 
            "hdf5": MatrixDatasetParamsDataFileFormat.HDF5}[str(data_file_format)]),
            description=description
        )
        log_status(f"calling add_dataset_uploads_client.sync_detailed")
        breadbox_response = add_dataset_uploads_client.sync_detailed(
            client=self.client,
            body=params,
        )
        breadbox_response_ = typing.cast(AddDatasetResponse, self._parse_client_response(breadbox_response))
        log_status(f"awaiting task result")
        result = self.await_task_result(breadbox_response_.id, timeout=timeout)
        log_status(f"task completed")
        return result


    def update_dataset(
            self,
            dataset_id: str,
            name: Union[str, Unset] = UNSET,
            dataset_metadata: Optional[dict] = None,
            group_id: Union[str, Unset] = UNSET,
            given_id: Union[str, Unset, None] = UNSET,
            description: Union[str, Unset, None] = UNSET,
            priority: Union[int, Unset, None] = UNSET,
    ) -> Union[MatrixDatasetResponse, TabularDatasetResponse]:
        """Update the values specified for the given dataset"""
        from breadbox_client.models import MatrixDatasetUpdateParams, TabularDatasetUpdateParams

        dataset = self.get_dataset(dataset_id)
        if isinstance(dataset, MatrixDatasetResponse):
            param_factory = lambda **kwargs: MatrixDatasetUpdateParams(format_="matrix", **kwargs)
            metadata = MatrixDatasetUpdateParamsDatasetMetadataType0.from_dict(
                dataset_metadata) if dataset_metadata else None
        else:
            assert isinstance(dataset, TabularDatasetResponse)
            param_factory = lambda **kwargs: TabularDatasetUpdateParams(format_="tabular", **kwargs)
            metadata = TabularDatasetUpdateParamsDatasetMetadataType0.from_dict(
                dataset_metadata) if dataset_metadata else None

        params = param_factory(
            name=name,
            dataset_metadata=metadata, # the types suggest this must be a specific type, but the generated code looks like passing in a generic dict would work fine
            group_id=group_id,
            given_id=given_id,
            description=description,
            priority=priority,
        )
        breadbox_response = update_dataset_client.sync_detailed(
            dataset_id=dataset_id,
            client=self.client,
            body=params,
        )
        return self._parse_client_response(breadbox_response)

    # TYPES

    def get_feature_types(self) -> list[FeatureTypeOut]:
        breadbox_response = get_feature_types_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_sample_types(self) -> list[SampleTypeOut]:
        breadbox_response = get_sample_types_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def add_dimension_type(self, name: str, id_column: str, axis: Union[AddDimensionTypeAxis, str], display_name: Optional[str] = None):
        if isinstance(axis, str):
            axis = AddDimensionTypeAxis(axis)

        params = AddDimensionType(
            axis=axis, 
            id_column=id_column, 
            name=name, 
            display_name=display_name if display_name is not None else UNSET
        )

        breadbox_response = add_dimension_type_client.sync_detailed(client=self.client, body=params)
        return self._parse_client_response(breadbox_response)

    def update_dimension_type(self, name: str, metadata_dataset_id: str, properties_to_index: List[str], display_name=UNSET):
        # display_name is set to UNSET for backwards compatibility
        params = UpdateDimensionType(display_name=display_name, metadata_dataset_id=metadata_dataset_id, properties_to_index=properties_to_index)

        breadbox_response = update_dimension_type_client.sync_detailed(name=name, client=self.client, body=params)
        return self._parse_client_response(breadbox_response)

    def get_dimension_types(self) -> list[DimensionType]:
        breadbox_response = get_dimension_types_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_dimension_type(self, name: str) -> DimensionType:
        breadbox_response = get_dimension_type_client.sync_detailed(name=name, client=self.client)
        return self._parse_client_response(breadbox_response)
    
    def delete_dimension_type(self, name: str):
        breadbox_response = remove_dimension_type_client.sync_detailed(name=name, client=self.client)
        return self._parse_client_response(breadbox_response)
    
    def get_dimension_type_identifiers(self, name: str) -> List[DimensionIdentifiers]:
        breadbox_response = get_dimension_type_identifiers_client.sync_detailed(name=name, client=self.client)
        return self._parse_client_response(breadbox_response)
    

    # DATA TYPES

    def add_data_type(self, name: str):
        breadbox_response = add_data_type_client.sync_detailed(
            client=self.client,
            body=BodyAddDataType.from_dict({"name": name}),
        )
        return self._parse_client_response(breadbox_response)

    def get_data_types(self) -> list[DataType]:
        breadbox_response = get_data_types_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def remove_data_type(self, name: str):
        breadbox_response = remove_data_type_client.sync_detailed(data_type=name, client=self.client)
        return self._parse_client_response(breadbox_response)

    # GROUPS

    def add_group(self, name: str) -> GroupOut:
        breadbox_response = add_group_client.sync_detailed(
            client=self.client,
            body=GroupIn(name=name),
        )
        return self._parse_client_response(breadbox_response)

    def get_groups(self) -> List[GroupOut]:
        breadbox_response = get_groups_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)
    
    def add_group_entry(self, group_id: str, email: str, access_type: AccessType, exact_match: bool = True) -> GroupEntry:
        group_entry_in = GroupEntryIn(access_type=access_type, email=email, exact_match=exact_match)
        breadbox_response = add_group_entry_client.sync_detailed(client=self.client, group_id=group_id, body=group_entry_in)
        return self._parse_client_response(breadbox_response)
    
    def remove_group_access(self, group_entry_id: str) -> str:
        breadbox_response = remove_group_access_client.sync_detailed(client=self.client, group_entry_id=group_entry_id)
        return self._parse_client_response(breadbox_response)

    # TEMP

    def get_associations(self) -> List[AssociationTable]:
        breadbox_response = get_associations_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def add_associations(self, dataset_1_id:str, dataset_2_id: str, axis :str, associations_table_filename : str) -> AssociationTable:
        with open(associations_table_filename, "rb") as fd:
            uploaded_file = self.upload_file(fd)

        associations_in = AssociationsIn(axis = AssociationsInAxis(axis), dataset_1_id=dataset_1_id, dataset_2_id=dataset_2_id, file_ids=uploaded_file.file_ids, md5=uploaded_file.md5)
        breadbox_response = add_associations_client.sync_detailed(client=self.client, body=associations_in)

        return self._parse_client_response(breadbox_response)

    def get_associations_for_slice(self, dataset_id: str, identifier: str, identifier_type: str) -> Associations:
        breadbox_response = get_associations_for_slice_client.sync_detailed(client=self.client, body=BodyGetAssociationsForSlice(SliceQuery(dataset_id=dataset_id, identifier=identifier,
                                                                                    identifier_type=SliceQueryIdentifierType(identifier_type))))
        return self._parse_client_response(breadbox_response)
    
    def evaluate_context(self, context_expression: dict) -> ContextMatchResponse:
        request_body = Context.from_dict(context_expression)
        breadbox_response = evaluate_context_client.sync_detailed(client=self.client, body=request_body)
        return self._parse_client_response(breadbox_response)
    
    def get_sql_schema(self, dataset_given_id: Optional[str] = None) -> dict[str, str]:
        breadbox_response = get_sql_schema.sync_detailed(client=self.client, dataset_given_id=dataset_given_id if dataset_given_id else UNSET)
        return self._parse_client_response(breadbox_response)

    def query_sql(self, sql: str) -> str:
        request_body = SqlQuery(sql=sql)
        breadbox_response = query_sql.sync_detailed(client=self.client, body=request_body)
        return self._parse_client_response(breadbox_response)
    
    # RELEASE VERSIONS
    
    def get_release_versions(self, release_name: Union[Optional[str], Unset] = UNSET, datatype: Union[Optional[str], Unset] = UNSET, start_date: Union[Optional[str], Unset] = UNSET, end_date: Union[Optional[date], Unset] = UNSET, include_files: bool = False ) -> List[ReleaseVersionResponse]:
        """Get all release versions with options to filter by release_name, datatype, start_date, end_date, include_files."""
        start_date_obj = None 
        end_date_obj = None
        if isinstance(start_date, str):
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()

        if isinstance(end_date, str):
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            
        breadbox_response = get_release_versions_client.sync_detailed(client=self.client,release_name=release_name,
        datatype=datatype,
        start_date=start_date_obj,
        end_date=end_date_obj,
        include_files=include_files )
        return self._parse_client_response(breadbox_response)

    
    def get_release_version(self, include_files: bool = False) -> ReleaseVersionResponse:
        """Get a single release with the option to include_files."""
        breadbox_response = get_release_version_client.sync_detailed(client=self.client, include_files=include_files)
        return self._parse_client_response(breadbox_response)
        
    def create_release_version(self, params: CreateReleaseVersionParams) -> ReleaseVersionResponse:
        """Create a new release version including its associated files and pipelines."""
        
        body = CreateReleaseVersionParams(
            version_name=params.version_name,
            release_name=params.release_name,
            version_date=params.version_date,
            description=params.description if params.description else UNSET,
            citation=params.citation if params.citation else UNSET,
            funding=params.funding if params.funding else UNSET,
            terms=params.terms if params.terms else UNSET,
            files=params.files,
            content_hash=params.content_hash,
            release_pipelines=params.release_pipelines,
        )
        breadbox_response = create_release_version_client.sync_detailed(
            client=self.client, 
            body=body
        )

        return self._parse_client_response(breadbox_response)
        
    def delete_release_version(self, release_version_id: str) -> dict[str, str]:
        """
        Delete a release version. Associated files and pipelines will be 
        deleted automatically via cascade.
        """
        breadbox_response = delete_release_version_client.sync_detailed(client=self.client, release_version_id=release_version_id)
        return self._parse_client_response(breadbox_response)

    # PREDICTIVE MODELS

    def get_all_predictive_model_results(self) -> List[PredictiveModelResultOut]:
        """Get summary of all stored predictive model results."""
        breadbox_response = get_all_predictive_model_results_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_all_predictive_model_configs(self) -> List[PredictiveModelConfigOut]:
        """Get all predictive model configs."""
        breadbox_response = get_all_predictive_model_configs_client.sync_detailed(client=self.client)
        return self._parse_client_response(breadbox_response)

    def get_predictive_model_configs_for_dimension_type(self, dimension_type_name: str) -> PredictiveModelConfigOut:
        """Get predictive model configs for a specific dimension type."""
        breadbox_response = get_predictive_model_configs_for_dimension_type_client.sync_detailed(
            dimension_type_name=dimension_type_name, client=self.client
        )
        return self._parse_client_response(breadbox_response)

    def create_predictive_model_configs(self, dimension_type_name: str, configs: List[ModelConfigIn]) -> PredictiveModelConfigOut:
        """Create predictive model configs for a dimension type (admin only)."""
        body = PredictiveModelConfigIn(configs=configs)
        breadbox_response = create_predictive_model_configs_client.sync_detailed(
            dimension_type_name=dimension_type_name, client=self.client, body=body
        )
        return self._parse_client_response(breadbox_response)

    def update_predictive_model_configs(self, dimension_type_name: str, configs: List[ModelConfigIn]) -> PredictiveModelConfigOut:
        """Update predictive model configs for a dimension type (admin only)."""
        body = PredictiveModelConfigIn(configs=configs)
        breadbox_response = update_predictive_model_configs_client.sync_detailed(
            dimension_type_name=dimension_type_name, client=self.client, body=body
        )
        return self._parse_client_response(breadbox_response)

    def delete_predictive_model_configs(self, dimension_type_name: str):
        """Delete all predictive model configs for a dimension type (admin only)."""
        breadbox_response = delete_predictive_model_configs_client.sync_detailed(
            dimension_type_name=dimension_type_name, client=self.client
        )
        return self._parse_client_response(breadbox_response)

    def get_predictive_models_for_feature(self, dataset_id: str, feature_given_id: str) -> PredictiveModelsResponse:
        """Get predictive model results for a specific feature in a dataset."""
        breadbox_response = get_predictive_models_for_feature_client.sync_detailed(
            dataset_id=dataset_id, feature_given_id=feature_given_id, client=self.client
        )
        return self._parse_client_response(breadbox_response)

    def bulk_load_predictive_model_results(
        self,
        dimension_type_name: str,
        config_name: str,
        actuals_dataset_id: str,
        predictions_dataset_id: str,
        results_file: IO[bytes],
        etag: str,
    ):
        """Bulk load predictive model results from a parquet file (admin only)."""
        uploaded_file = self.upload_file(results_file)
        body = BulkLoadResultsIn(
            etag=etag,
            file_ids=uploaded_file.file_ids,
            md5=uploaded_file.md5,
            predictions_dataset_id=predictions_dataset_id,
        )
        breadbox_response = bulk_load_predictive_model_results_client.sync_detailed(
            dimension_type_name=dimension_type_name,
            config_name=config_name,
            dataset_id=actuals_dataset_id,
            client=self.client,
            body=body,
        )
        return self._parse_client_response(breadbox_response)

    def delete_predictive_model_results(
        self,
        dimension_type_name: str,
        config_name: str,
        actuals_dataset_id: str,
    ):
        """Delete predictive model results for a config+dataset combination (admin only)."""
        breadbox_response = delete_predictive_model_results_client.sync_detailed(
            dimension_type_name=dimension_type_name,
            config_name=config_name,
            dataset_id=actuals_dataset_id,
            client=self.client,
        )
        return self._parse_client_response(breadbox_response)

    # API

    def get_task_status(self, id: str):
        """
        Get the task status for a given breadbox task id.
        The given id should be formatted like "breadbox/<task-uuid>".
        """
        breadbox_response = get_task_status_client.sync_detailed(id=id, client=self.client)
        return self._parse_client_response(breadbox_response)

    # COMPUTE

    def compute_univariate_associations(
        self,
        analysis_type: str,
        dataset_id: str,
        query_feature_id: Optional[str],
        query_dataset_id: Optional[str],
        vector_variable_type: Optional[str],
        query_cell_lines: Optional[list[str]],
        query_values: Optional[list[Any]],
    ) -> ComputeResponse:
        """
        Run custom analysis in breadbox using a breadbox dataset. Return a task status.
        """
        params = ComputeParams.from_dict(
            dict(
                analysisType=analysis_type,
                datasetId=dataset_id,
                queryId=None,  # deprecated query type, only used for Elara
                queryFeatureId=query_feature_id,
                queryDatasetId=query_dataset_id,
                vectorVariableType=vector_variable_type,
                queryCellLines=query_cell_lines,
                queryValues=query_values,
            )
        )
        # Convert the breadbox task status response into the similar format used by the legacy portal
        breadbox_response = compute_univariate_associations_client.sync_detailed(client=self.client, body=params)
        return self._parse_client_response(breadbox_response)

    # OTHER

    def await_task_result(self, task_id: str, timeout=None):
        """
        Await a given task response. Expect this to take longer than a normal request.
        If the task is successful, return the result. If it fails, raise an exception.
        This is a helpful utility, but does not map directly onto a breadbox endpoint.
        """
        start_time = time()
        task_response = {}
        task_state = "PENDING"
        while task_state == "PENDING" or task_state == "PROGRESS":
            task_response = self.get_task_status(task_id)
            task_state = task_response.get("state")
            assert task_state is not None
            if timeout is not None and (time() - start_time > timeout):
                raise TimeoutError()
            sleep(1)
        if task_state == "FAILURE":
            raise BreadboxException(f"Task failed: {task_response}")
        elif task_state == "SUCCESS":
            return task_response["result"]
        else:
            raise ValueError(f"Unexpected task state: {task_state}")

    def is_ok(self):
        response = ok.sync_detailed(client=self.client)
        return response


