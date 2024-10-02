import * as React from "react";
import { MatrixUpdateDatasetForm } from "./MatrixDatasetEditForm";
import { useState, useEffect, useMemo } from "react";
import {
  Dataset,
  DatasetUpdateArgs,
  DataType,
  Group,
  InvalidPrioritiesByDataType,
} from "@depmap/types";

interface DatasetEditFormProps {
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  getGroups: () => Promise<Group[]>;
  datasetToEdit: Dataset;
  updateDataset: (datasetToUpdate: DatasetUpdateArgs) => Promise<Dataset>;
}

export default function DatasetForm(props: DatasetEditFormProps) {
  const {
    getDataTypesAndPriorities,
    getGroups,
    datasetToEdit,
    updateDataset,
  } = props;

  const [groupOptions, setGroupsOptions] = useState<Group[]>([]);
  const [dataTypeOptions, setDataTypeOptions] = useState<DataType[]>([]);
  console.log(datasetToEdit);

  useEffect(() => {
    (async () => {
      try {
        const [dataTypesPriorities, groups] = await Promise.all([
          getDataTypesAndPriorities(),
          getGroups(),
        ]);

        const dataTypes = Object.keys(dataTypesPriorities).map((dType) => {
          return {
            name: dType,
          };
        });
        setDataTypeOptions(dataTypes);
        setGroupsOptions(groups);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [getGroups, getDataTypesAndPriorities]);

  const formComponent = useMemo(() => {
    const onSubmitForm = (formData: { [key: string]: any }) => {
      updateDataset(formData as DatasetUpdateArgs);
    };

    if (datasetToEdit.format === "matrix_dataset") {
      return (
        <MatrixUpdateDatasetForm
          groups={groupOptions}
          dataTypes={dataTypeOptions}
          datasetToUpdate={datasetToEdit}
          onSubmitForm={onSubmitForm}
        />
      );
    }
    if (datasetToEdit.format === "tabular_dataset") {
      return (
        <MatrixUpdateDatasetForm
          groups={groupOptions}
          dataTypes={dataTypeOptions}
          datasetToUpdate={datasetToEdit}
          onSubmitForm={onSubmitForm}
        />
      );
    }

    return null;
  }, [datasetToEdit, updateDataset, groupOptions, dataTypeOptions]);

  return <>{formComponent}</>;
}
