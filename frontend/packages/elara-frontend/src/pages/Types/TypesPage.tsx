import React, { useEffect, useState } from "react";
import { deprecatedBreadboxAPI } from "@depmap/api";
import {
  FeatureType,
  FeatureTypeUpdateArgs,
  SampleType,
  SampleTypeUpdateArgs,
  instanceOfBreadboxCustomException,
} from "@depmap/types";

import { FormModal, Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import { Button } from "react-bootstrap";
import styles from "src/pages/Types/styles.scss";
import TypeForm from "./TypeForm";

interface TypesPageProps {
  type: "sample" | "feature";
}

const formatTypeData = (types: SampleType[] | FeatureType[]) => {
  return types.map(({ name, id_column, dataset }) => {
    const dataset_name = dataset != null ? dataset.name : "";
    return { name, id_column, dataset_name };
  });
};

export default function TypesPage(props: TypesPageProps) {
  const { type } = props;
  const [types, setTypes] = useState<SampleType[] | FeatureType[] | null>(null);
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);
  const [typeSubmissionError, setTypeSubmissionError] = useState<string | null>(
    null
  );
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(
    new Set()
  );
  const [initialTypeValues, setInitialTypeValues] = useState<{
    name: string;
    id_column: string;
    metadata_file: "" | File;
  }>({
    name: "",
    id_column: "",
    metadata_file: "",
  });
  const [isTypeEdit, setIsTypeEdit] = useState<boolean>(false);

  const [initError, setInitError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (type === "sample") {
          const typesList = await deprecatedBreadboxAPI.getSampleTypes();
          setTypes(typesList);
        } else {
          const typesList = await deprecatedBreadboxAPI.getFeatureTypes();
          setTypes(typesList);
        }
      } catch (e) {
        console.error(e);
        setInitError(true);
      }
    })();
  }, [type]);

  if (!types) {
    return initError ? (
      // <div> className={styles.container}>
      <div>Sorry, there was an error fetching {type} types.</div>
    ) : (
      <Spinner />
    );
  }

  const onAddTypeSubmit = async (
    typeArgs: any,
    clear_state_callback: (isSuccessfulSubmit: boolean) => void
  ) => {
    let isSubmitted = false;
    // Reset submission error state on submit
    setTypeSubmissionError(null);
    try {
      const newType =
        type === "sample"
          ? await deprecatedBreadboxAPI.postSampleType(
              typeArgs // TODO: create model for args
            )
          : await deprecatedBreadboxAPI.postFeatureType(typeArgs);
      const newTypes = [...types, newType];
      setTypes(newTypes);

      setShowTypeModal(false);
      isSubmitted = true;
      setInitialTypeValues({
        name: "",
        id_column: "",
        metadata_file: "",
      });
    } catch (e) {
      console.error(e);
      if (instanceOfBreadboxCustomException(e)) {
        setTypeSubmissionError(e.detail);
      }
    }
    // In case of 400/500 error
    if (!isSubmitted) {
      if (types.map((t) => t.name).includes(typeArgs.name)) {
        setTypeSubmissionError(
          `'${typeArgs.name}' already exists! Type name must be unique.`
        );
      } else {
        setTypeSubmissionError(`Failed to submit ${typeArgs.name}!`);
      }
    }
    clear_state_callback(isSubmitted);
  };

  const onEditTypeSubmit = async (
    typeArgs: any,
    clear_state_callback: (isSuccessfulSubmit: boolean) => void
  ) => {
    let isSubmitted = false;
    // Reset submission error state on submit
    setTypeSubmissionError(null);
    const updateArgs = (({ name, metadata_file, annotation_type_mapping }) => {
      return { name, metadata_file, annotation_type_mapping };
    })(typeArgs);
    try {
      const newType =
        type === "sample"
          ? await deprecatedBreadboxAPI.updateSampleType(
              new SampleTypeUpdateArgs(
                updateArgs.name,
                updateArgs.metadata_file,
                updateArgs.annotation_type_mapping
              )
            )
          : await deprecatedBreadboxAPI.updateFeatureType(
              new FeatureTypeUpdateArgs(
                updateArgs.name,
                updateArgs.metadata_file,
                updateArgs.annotation_type_mapping
              )
            );
      const newTypes: SampleType[] | FeatureType[] = [];
      types.forEach((t) => {
        if (t.name !== typeArgs.name) {
          newTypes.push(t);
        }
      });
      setTypes([...newTypes, newType]);

      setShowTypeModal(false);
      isSubmitted = true;
      setInitialTypeValues({
        name: "",
        id_column: "",
        metadata_file: "",
      });
    } catch (e) {
      console.error(e);
      if (instanceOfBreadboxCustomException(e)) {
        setTypeSubmissionError(e.detail);
      }
    }
    // In case of 400/500 error
    if (!isSubmitted) {
      setTypeSubmissionError(`Failed to update ${typeArgs.name}!`);
    }
    clear_state_callback(isSubmitted);
  };

  const deleteButtonAction = async () => {
    let isDeleted = false;
    const typeIdsSet = new Set(selectedTypeIds);
    // TODO: Add alert!
    try {
      await Promise.all(
        Array.from(typeIdsSet).map((type_name) => {
          return type === "sample"
            ? deprecatedBreadboxAPI.deleteSampleType(type_name)
            : deprecatedBreadboxAPI.deleteFeatureType(type_name);
        })
      );
      isDeleted = true;
    } catch (e) {
      console.error(e);
    }
    if (isDeleted) {
      setTypes(types.filter((t) => !typeIdsSet.has(t.name)));
    }
  };

  return (
    <>
      <div className={styles.primaryButtons}>
        <Button
          bsStyle="primary"
          onClick={() => {
            setShowTypeModal(true);
            setIsTypeEdit(false);
          }}
        >
          Add {type.charAt(0).toUpperCase() + type.slice(1)} Type
        </Button>
        <Button
          bsStyle="danger"
          onClick={deleteButtonAction}
          disabled={selectedTypeIds.size === 0 || types.length === 0}
        >
          Delete Selected {type.charAt(0).toUpperCase() + type.slice(1)} Type
        </Button>
      </div>
      <FormModal
        bsSize="large"
        title={"Add " + type.charAt(0).toUpperCase() + type.slice(1) + " Type"}
        showModal={showTypeModal}
        onHide={() => {
          setShowTypeModal(false);
          setTypeSubmissionError(null);
          setInitialTypeValues({
            name: "",
            id_column: "",
            metadata_file: "",
          });
          setIsTypeEdit(false);
        }}
        formComponent={
          <TypeForm
            onSubmit={isTypeEdit ? onEditTypeSubmit : onAddTypeSubmit}
            submissionError={typeSubmissionError}
            isTypeEdit={isTypeEdit}
            initialValues={initialTypeValues}
          />
        }
      />

      <WideTable
        onChangeSelections={(selections) => {
          setSelectedTypeIds(new Set(selections));
        }}
        rowHeight={50}
        idProp="name"
        data={formatTypeData(types)}
        columns={[
          {
            accessor: "editButton",
            Header: "",
            maxWidth: 10,
            disableFilters: true,
            disableSortBy: true,
            Cell: (cellProps: any) => {
              const cellButton = (
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <Button
                    id={cellProps.row.original.id}
                    bsStyle="primary"
                    onClick={() => {
                      setIsTypeEdit(true);
                      setInitialTypeValues({
                        ...cellProps.row.values,
                        metadata_file: "",
                      });
                      setShowTypeModal(true);
                      console.log(cellProps.row.values);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              );
              if (
                type === "feature" &&
                cellProps.row.values.name === "generic"
              ) {
                return null;
              }

              return cellButton;
            },
          },
          { accessor: "name", Header: "Name" },
          { accessor: "id_column", Header: "ID Column" },
          { accessor: "dataset_name", Header: "Reference Dataset" },
        ]}
      />
    </>
  );
}
