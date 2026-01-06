import React from "react";
import { PartialPearsonCorrelationConfiguration } from "../../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../../reducers/analysisReducer";
import SingleSelectWithDynamicFields from "../selects/SingleSelectWithDynamicFields";
import AnalysisSliceSelect from "../selects/AnalysisSliceSelect";
import CustomMatrixSelect from "../selects/CustomMatrixSelect";
import Section from "./Section";

interface Props {
  analysis: PartialPearsonCorrelationConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function SliceSection({ analysis, dispatch }: Props) {
  return (
    <Section title="Select a data slice">
      <SingleSelectWithDynamicFields
        value={analysis.sliceSource}
        onChange={(nextSliceSource) => {
          dispatch({ type: "select_slice_source", payload: nextSliceSource });
        }}
        options={[
          {
            value: "portal_data",
            label: "Portal data",
            whenSelectedRender: () => (
              <AnalysisSliceSelect
                index_type={analysis.index_type}
                value={analysis.sliceQuery || undefined}
                onChange={(nextSliceQuery) => {
                  dispatch({
                    type: "select_slice_query",
                    payload: nextSliceQuery,
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
                format="slice"
                index_type={analysis.index_type}
                value={analysis.sliceQuery?.dataset_id}
                filename={analysis.customSliceFilename}
                onChange={(nextDatasetId, nextFilename) => {
                  dispatch({
                    type: "batch",
                    payload: [
                      {
                        type: "select_slice_query",
                        payload: nextDatasetId
                          ? {
                              dataset_id: nextDatasetId,
                              identifier_type: "feature_id",
                              identifier: "custom data",
                            }
                          : undefined,
                      },
                      {
                        type: "select_custom_slice_filename",
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

export default SliceSection;
