import { useEffect, useState } from "react";
import type { DataExplorerContextVariable } from "@depmap/types";
import { fetchMetadataAndOtherTabularDatasets } from "../../../utils/api-helpers";
import type { ExprReducerAction } from "./expressionReducer";

function useInitializer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainExpr: any,
  dimension_type: string,
  vars: Record<string, Partial<DataExplorerContextVariable>>,
  setVar: (key: string, value: Partial<DataExplorerContextVariable>) => void,
  dispatch: React.Dispatch<ExprReducerAction>
) {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      const seen = new Set<string>();
      const varsToCopy: string[][] = [];
      const varsToCreate: string[] = [];

      const nextExpr = JSON.parse(JSON.stringify(mainExpr), (key, value) => {
        if (key !== "var") {
          return value;
        }

        const oldName = value;
        const newName = crypto.randomUUID();

        // If the expression uses the magic variable "given_id",
        // turn it into a proper variable that can be edited.
        if (oldName === "given_id") {
          varsToCreate.push(newName);
          return newName;
        }

        // Duplicate any variables that appear more than once.
        // We need to do this so each rule can be edited independently.
        if (seen.has(oldName)) {
          varsToCopy.push([oldName, newName]);
          return newName;
        }

        seen.add(oldName);
        return oldName;
      });

      for (const [oldName, newName] of varsToCopy) {
        setVar(newName, vars[oldName]);
      }

      if (varsToCreate.length > 0) {
        const {
          metadataDataset,
          metadataIdColumn,
        } = await fetchMetadataAndOtherTabularDatasets(dimension_type);

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

        for (const newName of varsToCreate) {
          setVar(newName, {
            source: "metadata_column",
            dataset_id: metadataDataset.given_id || metadataDataset.id,
            identifier: metadataIdColumn,
            identifier_type: "column",
          });
        }
      }

      // If a variable lacks a `source` we'll try to infer it.
      for (const [name, variable] of Object.entries(vars)) {
        if (
          !variable.source &&
          variable.identifier_type === "column" &&
          variable.dataset_id?.endsWith("_metadata")
        ) {
          setVar(name, { ...variable, source: "metadata_column" });
        }
      }

      if (varsToCopy.length || varsToCreate.length) {
        dispatch({
          type: "update-value",
          payload: { path: [], value: nextExpr },
        });
      }

      setIsInitializing(false);
    })();

    // We only want the initializer code to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isInitializing;
}

export default useInitializer;
