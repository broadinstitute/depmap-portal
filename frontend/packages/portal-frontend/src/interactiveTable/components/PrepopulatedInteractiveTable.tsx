import React, { useState, useEffect } from "react";

import { Button } from "react-bootstrap";

import { DropdownState, VectorCatalog } from "@depmap/interactive";
import * as context from "src/common/utilities/context";
import "src/interactiveTable/styles/InteractiveTable.scss";

interface PrepopulatedInteractiveTableProps {
  initialfeatures: Array<string>;
  initialDropdownStates: Array<Array<DropdownState>>;
  feedbackUrl: string;
}

function PrepopulatedInteractiveTable(
  props: PrepopulatedInteractiveTableProps
) {
  const { initialfeatures, initialDropdownStates, feedbackUrl } = props;

  const [selectorCount, setSelectorCount] = useState<number>(
    initialfeatures.length + 1
  );
  const [selectedFeatures, setSelectedFeatures] = useState<Array<string>>(
    initialfeatures
  );
  const [tableInitialized, setTableInitialized] = useState<boolean>(false);

  const tableFrameId = "lineupTableIFrame";

  function reloadTableIframe(selectedFeatureIds: Array<string>): void {
    if (selectedFeatureIds.length > 0) {
      // get column data from the get-features endpoint
      const displayNameColId = "cell_line_display_name";
      const requestedFeatureIds = selectedFeatureIds.concat([displayNameColId]);
      const depmapAPI = context.getDapi();
      depmapAPI
        .getFeaturePlot(requestedFeatureIds, "", "", false)
        .then((PlotFeatures) => {
          const frameNode = document.getElementById(
            tableFrameId
          ) as HTMLIFrameElement;
          if (frameNode) {
            // The get-features endpoint returns the cell_line_display_name as the last feature but we want to show it first
            PlotFeatures.features.sort((x) =>
              x.feature_id === displayNameColId ? -1 : 0
            );
            // post a message to the iframe with the data
            frameNode.contentWindow?.postMessage(
              { selectionValue: PlotFeatures },
              "/"
            );
          }
        });
    }
  }

  useEffect(() => {
    // Syncronize the table iframe with state changes
    reloadTableIframe(selectedFeatures);
  }, [tableInitialized, selectedFeatures]);

  // Return a function that handles featuer selection events for the given VectorCatalog
  // by updating the state and URL
  function getFeatureSelectionHandler(
    selectorIndex: number
  ): (feature: string) => void {
    return (feature) => {
      const updatedSelectedFeatures = [...selectedFeatures];
      if (selectorIndex < selectedFeatures.length) {
        // update an existing selected feature
        updatedSelectedFeatures[selectorIndex] = feature;
      } else {
        // add the new selected feature to our state
        updatedSelectedFeatures.push(feature);
      }

      setSelectedFeatures(updatedSelectedFeatures);
      // update the URL
      const featuresUrlParam: string = updatedSelectedFeatures
        .map(encodeURIComponent)
        .join("&features=");
      window.history.replaceState(null, "", `?features=${featuresUrlParam}`);
    };
  }

  function onTableLoad() {
    setTableInitialized(true);
  }

  return (
    <div className="interactiveTablePage">
      <h2>LineUp Interactive Table</h2>
      <p className="lineupDescription">
        <a href="https://lineup.js.org/" target="_blank" rel="noreferrer">
          Lineup{" "}
        </a>
        is a visualization tool for exploring multiple tracks of data at once in
        a tabular view. Start by selecting data features you would like to
        include, and the visualization to the right will automatically update.
        The top of each column shows a distribution of the data which you can
        interact with to create filtered views. You may also use the Sort or
        Group buttons above each column to create custom rankings. Learn more
        about what’s possible in LineUp’s
        <a
          href="https://jku-vds-lab.at/tools/lineup/"
          target="_blank"
          rel="noreferrer"
        >
          {" "}
          official documentation
        </a>
        .
      </p>
      <div className="flexRow">
        <div className="featureSelectionPane">
          <h4>Select a feature to view it on the table</h4>
          {[...Array(selectorCount)].map((_, index) => (
            // eslint-disable-next-line
            <div key={index} className="featureSelector">
              <VectorCatalog
                onSelection={getFeatureSelectionHandler(index)}
                catalog="continuous_and_categorical"
                initialDropdowns={initialDropdownStates.pop()}
              />
            </div>
          ))}
          {selectorCount === selectedFeatures.length ? (
            <Button onClick={() => setSelectorCount(selectorCount + 1)}>
              Add a feature
            </Button>
          ) : null}
        </div>
        <div className="lineupWrapper">
          <iframe
            id={tableFrameId}
            width="100%"
            height="100%"
            src="./lineup"
            className="lineupTable"
            title="lineupTable"
            onLoad={onTableLoad}
          />
        </div>
      </div>
      <div className="feedbackRequest">
        <h3>Help Us Improve This Tool</h3>
        <p>
          Does something seem broken, confusing or frustrating to use? Is there
          anything you miss from the original Data Explorer? Are there things we
          could add or change to enhance your workflow or allow you to ask
          deeper questions of Portal data? Your feedback is greatly appreciated!
          Please take a moment to fill out{" "}
          <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
            this form
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default PrepopulatedInteractiveTable;
