import { useEffect, useState } from "react";
import type {
  DataExplorerContextVariable,
  TabularDataset,
} from "@depmap/types";
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
  const [initializationError, setInitializationError] = useState(false);

  const [data, setData] = useState(
    {} as {
      metadataDataset: TabularDataset | undefined;
      metadataIdColumn: string | undefined;
    }
  );

  useEffect(() => {
    (async () => {
      const seen = new Set<string>();
      const varsToCopy: string[][] = [];
      const varsToCreate: string[] = [];

      const {
        metadataDataset,
        metadataIdColumn,
      } = await fetchMetadataAndOtherTabularDatasets(dimension_type);

      setData({ metadataDataset, metadataIdColumn });

      const nextExpr = JSON.parse(JSON.stringify(mainExpr), (key, value) => {
        if (key !== "var") {
          return value;
        }

        const oldName = value;
        const newName = crypto.randomUUID();

        // If the expression uses the magic variable "given_id",
        // turn it into a proper variable that can be edited.
        // We give it the special variable name "list" so it will
        // behave exactly like an manual list a user created.
        if (oldName === "given_id") {
          varsToCreate.push("list");
          return "list";
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
        if (!metadataDataset) {
          setInitializationError(true);
          window.console.error(
            `Dimension type "${dimension_type}" has no metadata dataset!`
          );
          return;
        }

        if (!metadataIdColumn) {
          setInitializationError(true);
          window.console.error(
            `Dimension type "${dimension_type}" has no \`id_column\` set!`
          );
          return;
        }

        for (const newName of varsToCreate) {
          setVar(newName, {
            source: "property",
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
          setVar(name, { ...variable, source: "property" });
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

  return {
    isInitializing,
    initializationError,
    metadataDataset: data.metadataDataset,
    metadataIdColumn: data.metadataIdColumn,
  };
}

export default useInitializer;
