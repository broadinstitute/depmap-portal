import React, { useCallback, useEffect, useState } from "react";
import {
  Dataset,
  DatasetParams,
  DatasetTableData,
  DatasetUpdateArgs,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
  DimensionTypeWithCounts,
  Group,
  ErrorTypeError,
  TabularDataset,
} from "@depmap/types";

import { FormModal, Spinner, ToggleSwitch } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import Button from "react-bootstrap/lib/Button";

import styles from "../styles/styles.scss";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";

import DatasetForm from "./DatasetForm";
import { Alert } from "react-bootstrap";
import DatasetEditForm from "./DatasetEditForm";
import DimensionTypeForm from "./DimensionTypeForm";

export default function Datasets() {
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

  const getDimensionTypes = useCallback(
    () => breadboxAPI.getDimensionTypes(),
    []
  );
  const postDimensionType = useCallback(
    (dimTypeArgs: DimensionTypeAddArgs) =>
      breadboxAPI.postDimensionType(dimTypeArgs),
    []
  );
  const updateDimensionType = useCallback(
    (dimTypeName: string, dimTypeArgs: DimensionTypeUpdateArgs) =>
      breadboxAPI.updateDimensionType(dimTypeName, dimTypeArgs),
    []
  );

  const getDataTypesAndPriorities = useCallback(
    () => breadboxAPI.getDataTypesAndPriorities(),
    []
  );
  const postFileUpload = useCallback(
    (fileArgs: { file: File | Blob }) => breadboxAPI.postFileUpload(fileArgs),
    []
  );
  const postDatasetUpload = useCallback(
    (datasetParams: DatasetParams) =>
      breadboxAPI.postDatasetUpload(datasetParams),
    []
  );
  const updateDataset = useCallback(
    (datasetId: string, datasetUpdateArgs: DatasetUpdateArgs) =>
      breadboxAPI.updateDataset(datasetId, datasetUpdateArgs),
    []
  );

  const [dimensionTypes, setDimensionTypes] = useState<
    DimensionTypeWithCounts[] | null
  >(null);
  const [selectedDimensionType, setSelectedDimensionType] = useState<
    any | null
  >(null);
  const [isEditDimensionTypeMode, setIsEditDimensionTypeMode] = useState(false);
  const [showDimensionTypeModal, setShowDimensionTypeModal] = useState(false);

  const [isDeletingDataset, setIsDeletingDataset] = useState(false);
  const [datasetDeleteError, setDatasetDeleteError] = useState<string | null>(
    null
  );
  const [isDeletingDimType, setIsDeletingDimType] = useState(false);
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
        let currentDatasets = await breadboxAPI.getDatasets();

        // write access set to true if not advanced mode
        const availableGroups = await breadboxAPI.getGroups(!isAdvancedMode);
        if (!isAdvancedMode) {
          const group_ids = availableGroups.map((group) => {
            return group.id;
          });
          currentDatasets = currentDatasets.filter((dataset) =>
            group_ids.includes(dataset.group_id)
          );
          setUserGroups({ availableGroups, writeGroups: availableGroups });
        } else {
          const writeGroups = await breadboxAPI.getGroups(true);
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
  }, [getDimensionTypes, isAdvancedMode]);

  useEffect(() => {
    // Only show dataset delete error message for 3 seconds
    if (datasetDeleteError) {
      setTimeout(() => {
        setDatasetDeleteError(null);
      }, 3000);
    }
  }, [datasetDeleteError]);

  useEffect(() => {
    // Only show dim type delete error message for 3 seconds
    if (dimTypeDeleteError) {
      setTimeout(() => {
        setDimTypeDeleteError(null);
      }, 3000);
    }
  }, [dimTypeDeleteError]);

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
            getTaskStatus={legacyPortalAPI.getTaskStatus}
            onSuccess={(dataset: Dataset, showModal: boolean) => {
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
              // automatically close modal if success and no warnings
              setTimeout(() => {
                setShowDatasetModal(showModal);
              }, 1000);
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
      datasets={
        datasets.filter(
          (dataset) => dataset.format === "tabular_dataset"
        ) as TabularDataset[]
      }
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
    setIsDeletingDataset(true);
    setDatasetDeleteError(null);

    await Promise.all(
      Array.from(selectedDatasetIds).map((dataset_id) => {
        return breadboxAPI.deleteDataset(dataset_id);
      })
    )
      .then(() => {
        const datasetsRemaining = datasets.filter(
          (dataset) => !selectedDatasetIds.has(dataset.id)
        );
        setDatasets(datasetsRemaining);
        const dimTypeDatasetsNum = dimensionTypeDatasetCount(datasetsRemaining);
        const updatedDimensionTypeCounts = dimensionTypes.map((dt) => {
          return { ...dt, datasetsCount: dimTypeDatasetsNum[dt.name] };
        });
        setDimensionTypes(updatedDimensionTypeCounts);
        setSelectedDatasetIds(new Set());
      })
      .catch((e) => {
        console.error(e);
        if (e instanceof ErrorTypeError) {
          setDatasetDeleteError(e.message);
        } else {
          setDatasetDeleteError("An unknown error occurred!");
        }
      });

    setIsDeletingDataset(false);
  };

  const deleteDimensionType = async () => {
    if (selectedDimensionType != null) {
      setIsDeletingDimType(true);
      const dimensionType = dimensionTypes.find(
        (dt) => dt.name === selectedDimensionType.name
      );
      if (dimensionType) {
        await breadboxAPI
          .deleteDimensionType(dimensionType.name)
          .then(() => {
            setDimTypeDeleteError(null);
            setDimensionTypes(
              dimensionTypes.filter(
                (dt) => dt.name !== selectedDimensionType.name
              )
            );
            setSelectedDimensionType(null);
          })
          .catch((e) => {
            console.error(e);
            if (e instanceof ErrorTypeError) {
              setDimTypeDeleteError(e.message);
            } else {
              setDimTypeDeleteError("An unknown error occurred!");
            }
          });
      }
      setIsDeletingDimType(false);
    }
  };

  return (
    <>
      <div className="container-fluid">
        <div>
          <h1>Data Manager</h1>
          <ToggleSwitch
            value={isAdvancedMode}
            onChange={(newValue: boolean) => {
              setIsAdvancedMode(newValue);
            }}
            options={[
              { label: "UI Mode: Simple", value: false },
              { label: "Advanced", value: true },
            ]}
          />

          <div style={{ margin: "10px", width: "800px" }}>
            <p>
              Data Manager allows users to upload custom data into the portal
              for use along side any DepMap produced datasets.
            </p>
            <p>
              At the very top of this page, you will see a control for choosing
              between the &quot;Advanced&quot; or the &quot;Simple&quot; modes
              of the UI. Most users should use the &quot;Simple&quot; mode as
              this streamline the process of uploading data. Using this mode,
              data that is uploaded will appear in Data Explorer under the data
              type &quot;User Uploads&quot;.
            </p>
            <p>
              To upload a dataset, click the &quot;Upload new dataset&quot;
              button and fill out the corresponding form. Upon clicking
              &quot;Submit&quot; the process will start and may take a few
              seconds to complete. Once the upload is complete, either
              &quot;Success&quot; or a validation error will be reported at the
              bottom of the form. Once &quot;Success&quot; has been reported,
              you can close the form to return to the list of
              &quot;Datasets&quot; which should now include your newly added
              dataset.
            </p>
          </div>

          <h2>Datasets</h2>
          {datasetDeleteError !== null &&
            (selectedDatasetIds.size !== 0) !== null && (
              <Alert bsStyle="danger">
                <strong>Dataset Delete Failed!</strong> {datasetDeleteError}
              </Alert>
            )}
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
              disabled={
                selectedDatasetIds.size !== 1 ||
                datasets.length === 1 ||
                userGroups.writeGroups.length === 0
              }
            >
              Edit Selected Dataset
            </Button>
            <Button
              bsStyle="danger"
              onClick={() => deleteDatasetButtonAction()}
              disabled={
                selectedDatasetIds.size === 0 ||
                datasets.length === 0 ||
                userGroups.writeGroups.length === 0 ||
                isDeletingDataset
              }
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
                    (dataset) =>
                      dataset.id === selections[0] ||
                      dataset.given_id === selections[0]
                  );
                  setDatasetToEdit(selectedDataset || null);
                }
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
            <h2>Dimension Types</h2>

            {dimTypeDeleteError !== null && selectedDimensionType !== null && (
              <Alert bsStyle="danger">
                <strong>
                  Delete &quot;{selectedDimensionType.name}&quot; Failed!
                </strong>{" "}
                {dimTypeDeleteError}
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
                disabled={!selectedDimensionType || isDeletingDimType}
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
