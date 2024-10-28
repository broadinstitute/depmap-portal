import React from "react";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import DataSourceSelect from "./DataSourceSelect";
import MetadataColumnSelect from "./MetadataColumnSelect";
import AnnotationSelect from "./AnnotationSelect";
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
      {source === "annotation" && (
        <AnnotationSelect varName={varName as string} />
      )}
      {source === "matrix" && <MatrixDataSelect varName={varName as string} />}
    </>
  );
}

export default Variable;
