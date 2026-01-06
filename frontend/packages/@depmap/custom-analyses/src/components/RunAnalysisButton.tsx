import React, { useMemo } from "react";
import { Button } from "react-bootstrap";
import { AnalysisConfiguration } from "../types/AnalysisConfiguration";
import isCompleteAnalysisConfig from "../utils/isCompleteAnalysisConfig";
import getAnalysisKindDisplayName from "../utils/getAnalysisKindDisplayName";
import useValidator from "../hooks/useValidator";
import useRunHandler from "../hooks/useRunHandler";

interface Props {
  analysis: Partial<AnalysisConfiguration>;
}

function RunAnalysisButton({ analysis }: Props) {
  const isValidated = useValidator(analysis);

  const { handleClickRunAnalysis, isRunning } = useRunHandler(
    analysis as AnalysisConfiguration
  );

  const disabled = useMemo(() => {
    return !isCompleteAnalysisConfig(analysis) || !isValidated || isRunning;
  }, [analysis, isRunning, isValidated]);

  return (
    <Button
      bsStyle="primary"
      disabled={disabled}
      onClick={handleClickRunAnalysis}
    >
      {isRunning
        ? "Running..."
        : `Run ${getAnalysisKindDisplayName(analysis.kind)}`}
    </Button>
  );
}

export default RunAnalysisButton;
