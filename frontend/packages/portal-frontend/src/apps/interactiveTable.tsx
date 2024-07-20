import "src/public-path";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

import {
  formatPathToDropdown,
  DropdownState,
  OptionsInfoSelected,
} from "@depmap/interactive";
import { ApiContext } from "@depmap/api";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { getQueryParams } from "@depmap/utils";
import * as context from "src/common/utilities/context";
import PrepopulatedInteractiveTable from "src/interactiveTable/components/PrepopulatedInteractiveTable";
import styles from "src/common/styles/async_tile.module.scss";

const container = document.getElementById("react-interactive-table-root");
const dataElement = document.getElementById("react-interactive-table-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const { feedbackUrl } = JSON.parse(dataElement.textContent);

const App = () => {
  const [selectedFeatures] = useState<Array<string>>(() => {
    const queryParams = getQueryParams(new Set(["features"]));
    const features = Array.from(queryParams.features || []);
    return features;
  });
  const [initialDropdowns, setInitialDropdowns] = useState<
    Array<Array<DropdownState>>
  >([]);

  useEffect(() => {
    const promises = selectedFeatures.map((featureId: string) =>
      context
        .getVectorCatalogApi()
        .getVectorCatalogPath("continuous_and_categorical", featureId)
        .then((path: Array<OptionsInfoSelected>) => {
          const dropdownsAndSectionUpdates = formatPathToDropdown(path);
          const dropdownValues = dropdownsAndSectionUpdates[0] as Array<DropdownState>;
          return dropdownValues;
        })
    );
    Promise.all(promises).then(
      (allInitialDropdownValues: Array<Array<DropdownState>>) => {
        setInitialDropdowns(allInitialDropdownValues);
      }
    );
  }, [selectedFeatures]);

  return (
    <ErrorBoundary>
      <ApiContext.Provider value={context.apiFunctions.depmap}>
        {initialDropdowns.length === selectedFeatures.length && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <PrepopulatedInteractiveTable
              initialfeatures={selectedFeatures}
              initialDropdownStates={initialDropdowns}
              feedbackUrl={feedbackUrl}
            />
          </React.Suspense>
        )}
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
