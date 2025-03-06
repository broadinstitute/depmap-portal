import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Dataset,
  DatasetParams,
  DatasetTableData,
  DatasetUpdateArgs,
  // instanceOfErrorDetail,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
  Group,
  instanceOfErrorDetail,
} from "@depmap/types";

import { FormModal, Spinner, ToggleSwitch } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import Button from "react-bootstrap/lib/Button";

import styles from "../styles/styles.scss";
import { ApiContext } from "@depmap/api";

import DatasetForm from "./DatasetForm";
import { Alert } from "react-bootstrap";
import DatasetEditForm from "./DatasetEditForm";
import DimensionTypeForm from "./DimensionTypeForm";

export default function Datasets() {
  const { getApi } = useContext(ApiContext);
  const [dapi] = useState(() => getApi());
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [userGroups, setUserGroups] = useState<{
    availableGroups: Group[];
    writeGroups: Group[];
  }>({ availableGroups: [], writeGroups: [] });

  const [initError, setInitError] = useState(false);

  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(
    new Set()
  );
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [isEditDatasetMode, setIsEditDatasetMode] = useState(false);

  const [datasetToEdit, setDatasetToEdit] = useState<Dataset | null>(null);
  const [datasetMetadataToShow, setDatasetMetadataToShow] = useState<{
    [key: string]: string;
  } | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);

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

  const getTaskStatus = useCallback(
    (task_id: string) => dapi.getTaskStatus(task_id),
    [dapi]
  );

  const [dimensionTypes, setDimensionTypes] = useState<any[] | null>(null);
  const [selectedDimensionType, setSelectedDimensionType] = useState<
    any | null
  >(null);
  const [isEditDimensionTypeMode, setIsEditDimensionTypeMode] = useState(false);
  const [showDimensionTypeModal, setShowDimensionTypeModal] = useState(false);

  const [showDatasetDeleteError, setShowDatasetDeleteError] = useState(false);
  const [datasetDeleteError, setDatasetDeleteError] = useState<string | null>(
    null
  );
  const [showDimTypeDeleteError, setShowDimTypeDeleteError] = useState(false);
  const [dimTypeDeleteError, setDimTypeDeleteError] = useState<string | null>(
    null
  );

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
        let currentDatasets = await dapi.getBreadboxDatasets();

        // write access set to true if not advanced mode
        const availableGroups = await dapi.getGroups(!isAdvancedMode);
        if (!isAdvancedMode) {
          const group_ids = availableGroups.map((group) => {
            return group.id;
          });
          currentDatasets = currentDatasets.filter((dataset) =>
            group_ids.includes(dataset.group_id)
          );
          setUserGroups({ availableGroups, writeGroups: availableGroups });
        } else {
          const writeGroups = await dapi.getGroups(true);
          setUserGroups({ availableGroups, writeGroups });
        }

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
  }, [dapi, getDimensionTypes, isAdvancedMode]);

  const datasetForm = useCallback(() => {
    if (datasets) {
      let datasetFormComponent;
      let formTitle: string;

      if (isEditDatasetMode && datasetToEdit) {
        formTitle = "Edit Dataset";
        datasetFormComponent = (
          <DatasetEditForm
            groups={userGroups.availableGroups}
            getDataTypesAndPriorities={getDataTypesAndPriorities}
            onSubmit={async (
              datasetId: string,
              datasetToUpdate: DatasetUpdateArgs
            ) => {
              const updatedDataset = await updateDataset(
                datasetId,
                datasetToUpdate
              );
              setDatasets(
                datasets.map((d) => {
                  if (d.id === datasetId) {
                    return { ...d, ...updatedDataset };
                  }
                  return d;
                })
              );
              setDatasetToEdit(updatedDataset);
            }}
            datasetToEdit={datasetToEdit}
          />
        );
      }
      // eslint-disable-next-line no-else-return
      else {
        formTitle = "Add Dataset";
        datasetFormComponent = (
          <DatasetForm
            getDimensionTypes={getDimensionTypes}
            groups={userGroups.availableGroups}
            getDataTypesAndPriorities={getDataTypesAndPriorities}
            uploadFile={postFileUpload}
            uploadDataset={postDatasetUpload}
            isAdvancedMode={isAdvancedMode}
            getTaskStatus={getTaskStatus}
            onSuccess={(dataset: Dataset) => {
              const addedDatasets = [...datasets, dataset];
              setDatasets(addedDatasets);
              const dimTypeDatasetsNum = dimensionTypeDatasetCount(
                addedDatasets
              );
              setDimensionTypes((oldDimensionTypes) => {
                if (oldDimensionTypes == null) {
                  // condition to make eslint happy. TBD: consider changing typing
                  return null;
                }
                return oldDimensionTypes.map((dt) => {
                  return { ...dt, datasetsCount: dimTypeDatasetsNum[dt.name] };
                });
              });
            }}
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
          }}
          formComponent={datasetFormComponent}
        />
      );
    }
    return null;
  }, [
    datasets,
    isEditDatasetMode,
    datasetToEdit,
    showDatasetModal,
    userGroups.availableGroups,
    getDataTypesAndPriorities,
    updateDataset,
    getDimensionTypes,
    postFileUpload,
    postDatasetUpload,
    isAdvancedMode,
    getTaskStatus,
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
                setDatasetMetadataToShow(dataset.dataset_metadata);
                setShowMetadataForm(true);
              }}
            >
              View
            </Button>
          </div>
        ),
      };
    });
  };

  const onSubmitDimensionType = async (formData: any) => {
    if (isEditDimensionTypeMode && selectedDimensionType) {
      const updatedDimensionType = await updateDimensionType(
        selectedDimensionType.name,
        formData
      );
      const updatedDimensionTypes = dimensionTypes.map((dt) => {
        if (dt.name === updatedDimensionType.name) {
          return {
            ...updatedDimensionType,
            datasetsCount: selectedDimensionType.datasetsCount,
          };
        }
        return dt;
      });
      setDimensionTypes(updatedDimensionTypes);
    } else {
      const addedDimensionType = await postDimensionType(formData);
      setDimensionTypes([
        ...dimensionTypes,
        { ...addedDimensionType, datasetsCount: 0 },
      ]);
    }
  };

  const dimensionTypeForm = (
    <DimensionTypeForm
      onSubmit={onSubmitDimensionType}
      isEditMode={isEditDimensionTypeMode}
      dimensionTypeToEdit={selectedDimensionType}
      datasets={datasets.filter(
        (dataset) => dataset.format === "tabular_dataset"
      )}
    />
  );

  const datasetMetadataToShowForm = (
    datasetMetadata: { [key: string]: string } | null
  ) => {
    return (
      <FormModal
        title="Dataset Metadata"
        showModal={showMetadataForm}
        onHide={() => {
          setShowMetadataForm(false);
        }}
        formComponent={
          <div>
            <p>
              Current dataset metadata:{" "}
              {datasetMetadata
                ? JSON.stringify(datasetMetadata, null, 2)
                : "None"}
            </p>
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
    const datasetIdsSet = new Set(selectedDatasetIds);

    await Promise.all(
      Array.from(datasetIdsSet).map((dataset_id) => {
        return dapi.deleteDatasets(dataset_id);
      })
    )
      .then(() => {
        const datasetsRemaining = datasets.filter(
          (dataset) => !datasetIdsSet.has(dataset.id)
        );
        setDatasets(datasetsRemaining);
        const dimTypeDatasetsNum = dimensionTypeDatasetCount(datasetsRemaining);
        const updatedDimensionTypeCounts = dimensionTypes.map((dt) => {
          return { ...dt, datasetsCount: dimTypeDatasetsNum[dt.name] };
        });
        setDimensionTypes(updatedDimensionTypeCounts);
      })
      .catch((e) => {
        setShowDatasetDeleteError(true);
        console.error(e);
        if (instanceOfErrorDetail(e)) {
          setDatasetDeleteError(e.detail);
        }
      });
  };

  const deleteDimensionType = async () => {
    if (selectedDimensionType != null) {
      const dimensionType = dimensionTypes.find(
        (dt) => dt.name === selectedDimensionType.name
      );

      await dapi
        .deleteDimensionType(dimensionType.name)
        .then(() => {
          setShowDimTypeDeleteError(false);
          setDimTypeDeleteError(null);
          setDimensionTypes(
            dimensionTypes.filter(
              (dt) => dt.name !== selectedDimensionType.name
            )
          );
          setSelectedDimensionType(null);
        })
        .catch((e) => {
          setShowDimTypeDeleteError(true);
          console.error(e);
          if (instanceOfErrorDetail(e)) {
            setDimTypeDeleteError(e.detail);
          }
        });
    }
  };

  return (
    <>
      <div className="container-fluid">
        <div>
          <h1>Datasets</h1>
          {showDatasetDeleteError && (selectedDatasetIds.size !== 0) !== null && (
            <Alert bsStyle="danger">
              <strong>Dataset Delete Failed!</strong>{" "}
              {datasetDeleteError !== null ? datasetDeleteError : null}
            </Alert>
          )}
          <ToggleSwitch
            value={isAdvancedMode}
            onChange={(newValue: boolean) => {
              setIsAdvancedMode(newValue);
            }}
            options={[
              { label: "Simple", value: false },
              { label: "Advanced", value: true },
            ]}
          />
          <div className={styles.primaryButtons}>
            <Button
              bsStyle="primary"
              onClick={() => setShowDatasetModal(true)}
              disabled={userGroups.writeGroups.length === 0}
            >
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
                setShowDatasetDeleteError(false);
                setDatasetDeleteError(null);
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
        </div>

        {datasetForm()}
        {datasetMetadataToShowForm(datasetMetadataToShow)}

        {dimensionTypes && isAdvancedMode ? (
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

        {isAdvancedMode ? (
          <div>
            <h1>Dimension Types</h1>

            {showDimTypeDeleteError && selectedDimensionType !== null && (
              <Alert bsStyle="danger">
                <strong>
                  Delete &quot;{selectedDimensionType.name}&quot; Failed!
                </strong>{" "}
                {dimTypeDeleteError !== null ? dimTypeDeleteError : null}
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
                  setShowDimTypeDeleteError(false);
                  setDimTypeDeleteError(null);
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
        ) : null}
      </div>
    </>
  );
}
