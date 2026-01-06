import React from "react";
import {
  PartialPearsonCorrelationConfiguration,
  PartialTwoClassComparisonConfiguration,
} from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import SingleSelectWithDynamicFields from "../selects/SingleSelectWithDynamicFields";
import AnalysisDataVersionSelect from "../selects/AnalysisDataVersionSelect";
import CustomMatrixSelect from "../selects/CustomMatrixSelect";
import Section from "./Section";

interface Props {
  analysis:
    | PartialPearsonCorrelationConfiguration
    | PartialTwoClassComparisonConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function DatasetSection({ analysis, dispatch }: Props) {
  return (
    <Section title="Select a dataset">
      <SingleSelectWithDynamicFields
        value={analysis.dataSource}
        onChange={(nextDataSource) => {
          dispatch({ type: "select_data_source", payload: nextDataSource });
        }}
        options={[
          {
            value: "portal_data",
            label: "Portal data",
            whenSelectedRender: () => (
              <AnalysisDataVersionSelect
                index_type={analysis.index_type}
                value={analysis.datasetId || null}
                onChange={(nextDatasetId) => {
                  dispatch({
                    type: "select_dataset_id",
                    payload: nextDatasetId,
                  });
                }}
              />
            ),
          },
          {
            value: "custom",
            label: "Custom upload",
            whenSelectedRender: () => (
              <CustomMatrixSelect
                format="matrix"
                index_type={analysis.index_type}
                value={analysis.datasetId}
                filename={analysis.customDatasetFilename}
                onChange={(nextDatasetId, nextFilename) => {
                  dispatch({
                    type: "batch",
                    payload: [
                      { type: "select_dataset_id", payload: nextDatasetId },
                      {
                        type: "select_custom_dataset_filename",
                        payload: nextFilename,
                      },
                    ],
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

export default DatasetSection;
