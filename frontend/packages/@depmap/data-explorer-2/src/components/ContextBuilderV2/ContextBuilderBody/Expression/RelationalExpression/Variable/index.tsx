import React from "react";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import DataSourceSelect from "./DataSourceSelect";
import MetadataColumnSelect from "./MetadataColumnSelect";
import TabularDataSelect from "./TabularDataSelect";
import MatrixDataSelect from "./MatrixDataSelect";

interface Props {
  expr: { var: string } | null;
  path: (string | number)[];
}

function Variable({ expr, path }: Props) {
  const { vars } = useContextBuilderState();
  const varName = expr?.var || null;
  const slice = varName ? vars[varName] : null;
  const source = slice?.source || null;

  return (
    <>
      <DataSourceSelect expr={expr} path={path} />
      {source === "metadata_column" && (
        <MetadataColumnSelect varName={varName as string} />
      )}
      {source === "tabular_dataset" && (
        <TabularDataSelect varName={varName as string} />
      )}
      {source === "matrix_dataset" && (
        <MatrixDataSelect varName={varName as string} />
      )}
    </>
  );
}

export default Variable;
