import { useEffect, useRef, useState } from "react";
import type { DataExplorerContextVariable } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { fetchMetadataAndOtherTabularDatasets } from "../../../utils/api-helpers";
import type { ExprReducerAction } from "./expressionReducer";

function useInitializer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainExpr: any,
  dimension_type: string,
  setVar: (key: string, value: Partial<DataExplorerContextVariable>) => void,
  dispatch: React.Dispatch<ExprReducerAction>
) {
  const api = useDataExplorerApi();

  // given_id is a special "virtual variable" that will match on IDs of the
  // given dimension type. That behavior is nice in the Context Evaluator, but
  // it's not very useful here in the builder. Users need to be able to select
  // IDs and so we need to know what metadata dataset to fetch those from.
  // Therefore, when we see a variable with this special name, we convert it to
  // a proper variable.
  // NOTE: We're assuming that there will only be one such variable and that
  // it's at this exact path. While that's currently the only way given_id is
  // used in the Data Explorer UI code, it's a big assumption to make and could
  // easily break. A more robust implementation would walk the entire
  // expression looking for these variables.
  const shouldConvertGivenIdToMetadataColumn = useRef(
    mainExpr?.and?.[0]?.in?.[0]?.var === "given_id"
  );

  const [isInitializing, setIsInitializing] = useState(
    shouldConvertGivenIdToMetadataColumn.current
  );

  useEffect(() => {
    if (!shouldConvertGivenIdToMetadataColumn.current) {
      return;
    }

    shouldConvertGivenIdToMetadataColumn.current = false;

    (async () => {
      const {
        metadataDataset,
        metadataIdColumn,
      } = await fetchMetadataAndOtherTabularDatasets(api, dimension_type);

      if (!metadataDataset) {
        throw new Error(
          `Dimension type "${dimension_type}" has no metadata dataset!`
        );
      }

      if (!metadataIdColumn) {
        throw new Error(
          `Dimension type "${dimension_type}" has no \`id_column\` set!`
        );
      }

      const nextVarName = crypto.randomUUID();
      const ids = mainExpr.and[0].in[1];

      dispatch({
        type: "update-value",
        payload: {
          path: ["and", 0],
          value: { in: [{ var: nextVarName }, ids] },
        },
      });

      setVar(nextVarName, {
        source: "metadata_column",
        dataset_id: metadataDataset.given_id || metadataDataset.id,
        identifier: metadataIdColumn,
        identifier_type: "column",
      });

      setIsInitializing(false);
    })();
  }, [api, dimension_type, mainExpr, setVar, dispatch]);

  return isInitializing;
}

export default useInitializer;
