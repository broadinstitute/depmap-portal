import React from "react";
import {
  getDimensionTypeLabel,
  pluralize,
  uncapitalize,
} from "@depmap/data-explorer-2";
import { PartialTwoClassComparisonConfiguration } from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import AnalysisFilterSelect from "../selects/AnalysisFilterSelect";
import Section from "./Section";

interface Props {
  analysis: PartialTwoClassComparisonConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function InGroupSection({ analysis, dispatch }: Props) {
  const entity = getDimensionTypeLabel(analysis.index_type);
  const entities = uncapitalize(pluralize(entity));

  return (
    <Section title={`Select “in” group ${entities}`}>
      <AnalysisFilterSelect
        context_type={analysis.index_type}
        value={analysis.inGroupContext || null}
        onChange={(nextContext) => {
          dispatch({
            type: "select_in_group_context",
            payload: nextContext || undefined,
          });
        }}
      />
    </Section>
  );
}

export default InGroupSection;
