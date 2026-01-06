import React from "react";
import { AnalysisConfiguration } from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import AnalysisKindSelect from "../selects/AnalysisKindSelect";
import Section from "./Section";

interface Props {
  analysis: Partial<AnalysisConfiguration>;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function KindSection({ analysis, dispatch }: Props) {
  return (
    <Section title="Select type of analysis to run">
      <AnalysisKindSelect
        value={analysis.kind}
        onChange={(nextKind) => {
          dispatch({ type: "select_kind", payload: nextKind });
        }}
      />
    </Section>
  );
}

export default KindSection;
