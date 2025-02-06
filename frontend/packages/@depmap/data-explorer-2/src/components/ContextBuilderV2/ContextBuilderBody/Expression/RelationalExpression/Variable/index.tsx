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

const Selects = {
  metadata_column: MetadataColumnSelect,
  tabular_dataset: TabularDataSelect,
  matrix_dataset: MatrixDataSelect,
};

function Variable({ expr, path }: Props) {
  const { vars } = useContextBuilderState();
  const varName = expr?.var || null;
  const slice = varName ? vars[varName] : null;
  const source = slice?.source || null;
  const SliceQuerySelect = source ? Selects[source] : () => null;

  return (
    <>
      <DataSourceSelect expr={expr} path={path} />
      <SliceQuerySelect varName={varName as string} />
    </>
  );
}

export default Variable;
