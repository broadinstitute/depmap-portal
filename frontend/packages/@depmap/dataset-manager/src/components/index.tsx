import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Dataset,
  DatasetParams,
  DatasetTableData,
  DatasetUpdateArgs,
  // instanceOfErrorDetail,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
} from "@depmap/types";

import { FormModal, Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import Button from "react-bootstrap/lib/Button";

import styles from "../styles/styles.scss";
import { ApiContext } from "@depmap/api";

import DatasetForm from "./DatasetForm";
import DatasetMetadataForm from "./DatasetMetadataForm";
import { Alert } from "react-bootstrap";
import DatasetEditForm from "./DatasetEditForm";
import DimensionTypeForm from "./DimensionTypeForm";

export default function Datasets() {
  const { getApi } = useContext(ApiContext);
  const [dapi] = useState(() => getApi());
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);

  const [initError, setInitError] = useState(false);
  // const [datasetSubmissionError, setDatasetSubmissionError] = useState<
  //   string | null
  // >(null);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(
    new Set()
  );
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [isEditDatasetMode, setIsEditDatasetMode] = useState(false);
  const [
    showUpdateDatasetMetadataModal,
    setShowUpdateDatasetMetadataModal,
  ] = useState(false);
  const [datasetToEdit, setDatasetToEdit] = useState<Dataset | null>(null);
  const [datasetMetadataToEdit, setDatasetMetadataToEdit] = useState<{
    [key: string]: string;
  } | null>(null);

  // TODO: Remove
  const getFeatureTypes = useCallback(() => dapi.getFeatureTypes(), [dapi]);
  const getSampleTypes = useCallback(() => dapi.getSampleTypes(), [dapi]);

  const getDimensionTypes = useCallback(() => dapi.getDimensionTypes(), [dapi]);
  const postDimensionType = useCallback(
    (dimTypeArgs: DimensionTypeAddArgs) => dapi.postDimensionType(dimTypeArgs),
    [dapi]
  );
  const updateDimensionType = useCallback(
    (dimTypeName: string, dimTypeArgs: DimensionTypeUpdateArgs) =>
      dapi.updateDimensionType(dimTypeName, dimTypeArgs),
    [dapi]
  );
  const getGroups = useCallback(() => dapi.getGroups(), [dapi]);
  const getDataTypesAndPriorities = useCallback(
    () => dapi.getDataTypesAndPriorities(),
    [dapi]
  );
  const postFileUpload = useCallback(
    (fileArgs: { file: File | Blob }) => dapi.postFileUpload(fileArgs),
    [dapi]
  );
  const postDatasetUpload = useCallback(
    (datasetParams: DatasetParams) => dapi.postDatasetUpload(datasetParams),
    [dapi]
  );
  const updateDataset = useCallback(
    (datasetId: string, datasetUpdateArgs: DatasetUpdateArgs) =>
      dapi.updateDataset(datasetId, datasetUpdateArgs),
    [dapi]
  );

  const [dimensionTypes, setDimensionTypes] = useState<any[] | null>(null);
  const [selectedDimensionType, setSelectedDimensionType] = useState<
    any | null
  >(null);
  const [isEditDimensionTypeMode, setIsEditDimensionTypeMode] = useState(false);
  const [showDimensionTypeModal, setShowDimensionTypeModal] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);

  const dimensionTypeDatasetCount = (datasetsList: Dataset[]) =>
    datasetsList.reduce(
      (acc: { [key: string]: number }, curDataset: Dataset) => {
        if (curDataset.format === "matrix_dataset") {
          if (!(curDataset.feature_type_name in acc)) {
            acc[curDataset.feature_type_name] = 1;
          } else {
            acc[curDataset.feature_type_name] += 1;
          }
          if (!(curDataset.sample_type_name in acc)) {
            acc[curDataset.sample_type_name] = 1;
          } else {
            acc[curDataset.sample_type_name] += 1;
          }
        }
        if (curDataset.format === "tabular_dataset") {
          if (!(curDataset.index_type_name in acc)) {
            acc[curDataset.index_type_name] = 1;
          } else {
            acc[curDataset.index_type_name] += 1;
          }
        }
        return acc;
      },
      {}
    );

  useEffect(() => {
    (async () => {
      try {
        const currentDatasets = await dapi.getBreadboxDatasets();

        setDatasets(currentDatasets);
        const dimensionTypeDatasetNum = dimensionTypeDatasetCount(
          currentDatasets
        );

        const dimensionTypesWithDatasetCounts = (await getDimensionTypes()).map(
          (dt) => {
            return {
              ...dt,
              datasetsCount:
                dt.name in dimensionTypeDatasetNum
                  ? dimensionTypeDatasetNum[dt.name]
                  : 0,
            };
          }
        );
        setDimensionTypes(dimensionTypesWithDatasetCounts);
      } catch (e) {
        console.error(e);
        setInitError(true);
      }
    })();
  }, [dapi, getDimensionTypes]);

  const datasetForm = useCallback(() => {
    if (datasets) {
      let datasetFormComponent;
      let formTitle: string;

      if (isEditDatasetMode && datasetToEdit) {
        formTitle = "Edit Dataset";
        datasetFormComponent = (
          <DatasetEditForm
            getGroups={getGroups}
            getDataTypesAndPriorities={getDataTypesAndPriorities}
            updateDataset={updateDataset}
            datasetToEdit={datasetToEdit}
          />
        );
      }
      // eslint-disable-next-line no-else-return
      else {
        formTitle = "Add Dataset";
        datasetFormComponent = (
          <DatasetForm
            getFeatureTypes={getFeatureTypes}
            getSampleTypes={getSampleTypes}
            getGroups={getGroups}
            getDataTypesAndPriorities={getDataTypesAndPriorities}
            uploadFile={postFileUpload}
            uploadDataset={postDatasetUpload}
          />
        );
      }
      return (
        <FormModal
          title={formTitle}
          showModal={showDatasetModal}
          onHide={() => {
            setShowDatasetModal(false);
            setIsEditDatasetMode(false);
            setDatasetToEdit(null);
            setDatasetMetadataToEdit(null);
          }}
          formComponent={datasetFormComponent}
        />
      );
    }
    return null;
  }, [
    datasetToEdit,
    datasets,
    getDataTypesAndPriorities,
    getFeatureTypes,
    getGroups,
    getSampleTypes,
    isEditDatasetMode,
    postDatasetUpload,
    postFileUpload,
    showDatasetModal,
    updateDataset,
  ]);

  if (!datasets || !dimensionTypes) {
    return initError ? (
      <div className={styles.container}>
        Sorry, there was an error fetching datasets or dimension types.
      </div>
    ) : (
      <Spinner />
    );
  }
  const getTabularDatasetDimensionTypeByAxis = (
    dimensionName: string,
    axis: "feature" | "sample"
  ) => {
    const dimType = dimensionTypes.find(
      (dt) => dimensionName === dt.name && dt.axis === axis
    );
    if (dimType) {
      return dimensionName;
    }
    return null;
  };

  const formatDatasetTableData = (
    datasetsList: Dataset[]
  ): DatasetTableData[] => {
    return datasetsList.map((dataset) => {
      const groupName = dataset.group.name;

      return {
        id: dataset.id,
        name: dataset.name,
        groupName,
        featureType:
          dataset.format === "matrix_dataset"
            ? dataset.feature_type_name
            : getTabularDatasetDimensionTypeByAxis(
                dataset.index_type_name,
                "feature"
              ),
        sampleType:
          dataset.format === "matrix_dataset"
            ? dataset.sample_type_name
            : getTabularDatasetDimensionTypeByAxis(
                dataset.index_type_name,
                "sample"
              ),
        dataType: dataset.data_type,
        datasetMetadata: (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span aria-hidden="true" style={{ paddingRight: "5px" }} />
            <Button
              id={dataset.id}
              bsStyle="primary"
              bsSize="small"
              onClick={() => {
                setShowUpdateDatasetMetadataModal(true);
                setDatasetToEdit(dataset);
                setDatasetMetadataToEdit(
                  dataset.dataset_metadata ? dataset.dataset_metadata : null
                ); // handled in DatasetMetadataForm.tsx:261
              }}
            >
              View / Edit
            </Button>
          </div>
        ),
      };
    });
  };

  const dimensionTypeForm = (
    <DimensionTypeForm
      addDimensionType={postDimensionType}
      updateDimensionType={updateDimensionType}
      isEditMode={isEditDimensionTypeMode}
      dimensionTypeToEdit={selectedDimensionType}
      datasets={datasets.filter(
        (dataset) => dataset.format === "tabular_dataset"
      )}
    />
  );

  const onSubmitUpdateDatasetMetadata = async (
    datasetId: string,
    metadata: { [key: string]: string }
  ) => {
    try {
      const selectedDataset = datasets.filter(
        (dataset) => dataset.id === datasetId
      )[0];

      const updatedDatasetInfo: DatasetUpdateArgs = {
        group_id: selectedDataset.group.id,
        dataset_metadata: metadata,
      };

      const dataset = await dapi.updateDataset(datasetId, updatedDatasetInfo);
      setShowUpdateDatasetMetadataModal(false);
      setDatasets(
        datasets.map((originalDataset) => {
          if (originalDataset.id === datasetId) {
            return dataset;
          }
          return originalDataset;
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateDatasetMetadataForm = (
    datasetId: string,
    datasetMetadata: { [key: string]: string }
  ) => {
    return (
      <FormModal
        title="Update Dataset Metadata"
        showModal={showUpdateDatasetMetadataModal}
        onHide={() => {
          setShowUpdateDatasetMetadataModal(false);
          setDatasetToEdit(null);
          setDatasetMetadataToEdit(null);
        }}
        formComponent={
          <div>
            <DatasetMetadataForm
              isEdit
              datasetId={datasetId}
              initDatasetMetadata={datasetMetadata}
              onSubmit={onSubmitUpdateDatasetMetadata}
            />
          </div>
        }
      />
    );
  };

  const handleEditDatasetButtonClick = () => {
    setIsEditDatasetMode(true);
    setShowDatasetModal(true);
  };

  const handleEditDimensionTypeButtonClick = () => {
    setIsEditDimensionTypeMode(true);
    setShowDimensionTypeModal(true);
  };

  const deleteDatasetButtonAction = async () => {
    let isDeleted = false;
    const datasetIdsSet = new Set(selectedDatasetIds);
    try {
      await Promise.all(
        Array.from(datasetIdsSet).map((dataset_id) => {
          return dapi.deleteDatasets(dataset_id);
        })
      );
      isDeleted = true;
      setShowDeleteError(false);
    } catch (e) {
      setShowDeleteError(true);
      console.error(e);
    }
    if (isDeleted) {
      const datasetsRemaining = datasets.filter(
        (dataset) => !datasetIdsSet.has(dataset.id)
      );
      setDatasets(datasetsRemaining);
      const dimTypeDatasetsNum = dimensionTypeDatasetCount(datasetsRemaining);
      const updatedDimensionTypeCounts = dimensionTypes.map((dt) => {
        return { ...dt, datasetsCount: dimTypeDatasetsNum[dt.name] };
      });
      setDimensionTypes(updatedDimensionTypeCounts);
    }
  };

  const deleteDimensionType = async () => {
    let isDeleted = false;

    try {
      if (selectedDimensionType != null) {
        const dimensionType = dimensionTypes.find(
          (dt) => dt.name === selectedDimensionType.name
        );
        if (dimensionType.axis === "feature") {
          await dapi.deleteFeatureType(dimensionType.name);
        } else {
          await dapi.deleteSampleType(dimensionType.name);
        }

        isDeleted = true;
        setShowDeleteError(false);
      }
    } catch (e) {
      setShowDeleteError(true);
      console.error(e);
    }
    if (isDeleted) {
      setDimensionTypes(
        dimensionTypes.filter((dt) => dt.name !== selectedDimensionType.name)
      );
      setSelectedDimensionType(null);
    }
  };

  return (
    <>
      <div className="container-fluid">
        <h1>Datasets</h1>
        <div className={styles.primaryButtons}>
          <Button bsStyle="primary" onClick={() => setShowDatasetModal(true)}>
            Upload New Dataset
          </Button>
          <Button
            bsStyle="default"
            onClick={() => handleEditDatasetButtonClick()}
            disabled={selectedDatasetIds.size !== 1 || datasets.length === 1}
          >
            Edit Selected Dataset
          </Button>
          <Button
            bsStyle="danger"
            onClick={() => deleteDatasetButtonAction()}
            disabled={selectedDatasetIds.size === 0 || datasets.length === 0}
          >
            Delete Selected Dataset
          </Button>
        </div>
        <div className={styles.tableView}>
          <WideTable
            rowHeight={40}
            idProp="id"
            onChangeSelections={(selections) => {
              setSelectedDatasetIds(new Set(selections));
              // If only one dataset is selected, assign that as the dataset to edit
              if (selections.length === 1) {
                const selectedDataset = datasets.find(
                  (dataset) => dataset.id === selections[0]
                );
                setDatasetToEdit(selectedDataset || null);
              }
            }}
            data={formatDatasetTableData(datasets)}
            columns={[
              {
                accessor: "name",
                Header: "Name",
                minWidth: 200,
                maxWidth: 800,
              },
              {
                accessor: "featureType",
                Header: "Feature Type",
                minWidth: 100,
                maxWidth: 300,
              },
              {
                accessor: "sampleType",
                Header: "Sample Type",
                minWidth: 100,
                maxWidth: 300,
              },
              { accessor: "groupName", Header: "Group Name", maxWidth: 300 },
              {
                accessor: "dataType",
                Header: "Data Type",
                minWidth: 100,
                maxWidth: 200,
              },
              {
                accessor: "datasetMetadata",
                Header: "Dataset Metadata",
                width: 20,
                disableFilters: true,
                disableSortBy: true,
              },
            ]}
          />
        </div>

        {datasetForm()}
        {datasetToEdit !== null && datasetMetadataToEdit !== null
          ? updateDatasetMetadataForm(datasetToEdit.id, datasetMetadataToEdit)
          : null}

        {dimensionTypes ? (
          <FormModal
            title={
              isEditDimensionTypeMode
                ? "Edit Dimension Type"
                : "Add Dimension Type"
            }
            showModal={showDimensionTypeModal}
            onHide={() => {
              setShowDimensionTypeModal(false);
              setIsEditDimensionTypeMode(false);
            }}
            formComponent={dimensionTypeForm}
          />
        ) : null}

        <h1>Dimension Types</h1>

        {showDeleteError && (
          <Alert bsStyle="danger">
            <strong>
              Delete &quot;{selectedDimensionType.name}&quot; Failed!
            </strong>{" "}
            Make sure &quot;{selectedDimensionType.name}&quot; has no datasets
            with its dimension type.
          </Alert>
        )}

        <div className={styles.primaryButtons}>
          <Button
            bsStyle="primary"
            onClick={() => setShowDimensionTypeModal(true)}
          >
            Create New Dimension Type
          </Button>
          <Button
            bsStyle="default"
            onClick={() => handleEditDimensionTypeButtonClick()}
            disabled={!selectedDimensionType}
          >
            Edit Selected Dimension Type
          </Button>
          <Button
            bsStyle="danger"
            onClick={() => deleteDimensionType()}
            disabled={!selectedDimensionType}
          >
            Delete Selected Dimension Type
          </Button>
        </div>

        <div className={styles.tableView}>
          <WideTable
            idProp="name"
            onChangeSelections={(selections) => {
              if (selections.length > 0) {
                const selectedDimType = dimensionTypes.find(
                  (dt) => dt.name === selections[0]
                );
                setSelectedDimensionType(selectedDimType || null);
              } else {
                setSelectedDimensionType(null);
              }
              setShowDeleteError(false);
            }}
            rowHeight={40}
            columns={[
              { accessor: "name", Header: "Name" },
              { accessor: "display_name", Header: "Display Name" },
              { accessor: "axis", Header: "Type" },
              { accessor: "datasetsCount", Header: "Datasets" },
            ]}
            data={dimensionTypes}
            singleSelectionMode
          />
        </div>
      </div>
    </>
  );
}
