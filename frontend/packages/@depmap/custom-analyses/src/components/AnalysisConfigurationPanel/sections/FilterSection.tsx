import React from "react";
import {
  getDimensionTypeLabel,
  pluralize,
  uncapitalize,
} from "@depmap/data-explorer-2";
import { PartialPearsonCorrelationConfiguration } from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import SingleSelectWithDynamicFields from "../selects/SingleSelectWithDynamicFields";
import AnalysisFilterSelect from "../selects/AnalysisFilterSelect";
import Section from "./Section";

interface Props {
  analysis: PartialPearsonCorrelationConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function FilterSection({ analysis, dispatch }: Props) {
  const entity = getDimensionTypeLabel(analysis.index_type);
  const entities = uncapitalize(pluralize(entity));

  return (
    <Section title={`Select ${entities} to run on`}>
      <SingleSelectWithDynamicFields
        value={analysis.unfiltered}
        onChange={(nextValue) => {
          dispatch({ type: "select_unfiltered", payload: nextValue });
        }}
        options={[
          { value: true, label: `Use all ${entities}` },
          {
            value: false,
            label: `Select a subset of ${entities}`,
            whenSelectedRender: () => (
              <AnalysisFilterSelect
                context_type={analysis.index_type}
                value={analysis.filterByContext || null}
                onChange={(nextContext) => {
                  dispatch({
                    type: "select_filter_by_context",
                    payload: nextContext || undefined,
                  });
                }}
              />
            ),
          },
        ]}
      />
    </Section>
  );
}

export default FilterSection;
