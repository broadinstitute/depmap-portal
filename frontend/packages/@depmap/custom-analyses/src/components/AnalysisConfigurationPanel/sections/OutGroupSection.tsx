import React from "react";
import {
  getDimensionTypeLabel,
  pluralize,
  uncapitalize,
} from "@depmap/data-explorer-2";
import { PartialTwoClassComparisonConfiguration } from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import SingleSelectWithDynamicFields from "../selects/SingleSelectWithDynamicFields";
import AnalysisFilterSelect from "../selects/AnalysisFilterSelect";
import Section from "./Section";
import OverlappingIdentifiersWarning from "./OverlappingIdentifiersWarning";

interface Props {
  analysis: PartialTwoClassComparisonConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function OutGroupSection({ analysis, dispatch }: Props) {
  const entity = getDimensionTypeLabel(analysis.index_type);
  const entities = uncapitalize(pluralize(entity));

  return (
    <Section title={`Select “out” group ${entities}`}>
      <SingleSelectWithDynamicFields
        value={analysis.useAllOthers}
        onChange={(nextValue) => {
          dispatch({ type: "select_use_all_others", payload: nextValue });
        }}
        options={[
          { value: true, label: `Use all other ${entities}` },
          {
            value: false,
            label: `Select a subset of ${entities}`,
            whenSelectedRender: () => (
              <div>
                <AnalysisFilterSelect
                  context_type={analysis.index_type}
                  value={analysis.outGroupContext || null}
                  onChange={(nextContext) => {
                    dispatch({
                      type: "select_out_group_context",
                      payload: nextContext || undefined,
                    });
                  }}
                />
                <OverlappingIdentifiersWarning
                  inGroupContext={analysis.inGroupContext}
                  outGroupContext={analysis.outGroupContext}
                  entities={entities}
                />
              </div>
            ),
          },
        ]}
      />
    </Section>
  );
}

export default OutGroupSection;
