import * as React from "react";
import { useEffect } from "react";
import { Dropdown, Button } from "react-bootstrap";
import { BoxSelectIcon } from "@depmap/common-components";
import { SelectToLabelProps } from "../models/selectToLabel";

import * as utils from "../utilities/selectToLabelUtils";

export const SelectToLabel = (props: SelectToLabelProps) => {
  // assert that the layout contains annotations that can be moved
  useEffect(() => {
    utils.assertCorrectSetup(props.plotlyLayout);
  }, [props.plotlyLayout, props.plotlyConfig]);

  return (
    <Dropdown
      id={`${props.idPrefixForUniqueness}-download-plot-icon`}
      // @ts-expect-error bsSize is valid, see https://github.com/react-bootstrap/react-bootstrap/blob/v0.33.1/src/Dropdown.js#L324
      bsSize="small"
      className="react-base-plot-toolbar-download"
      dropup={props.dropup}
    >
      <Dropdown.Toggle>
        <span className="glyphicon glyphicon-plus-sign" /> Labels
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ padding: "20px" }}>
        <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
          <div style={{ whiteSpace: "nowrap" }}>
            <span>Select points to label:</span>
            <span style={{ padding: "5px" }}>
              <BoxSelectIcon
                onClick={props.setDragmodeBoxSelect}
                bsSize="small"
              />
            </span>
          </div>
          <div>
            {utils.isValidSelection(props.plotlySelectedEvent) && (
              <div style={{ whiteSpace: "nowrap" }}>
                <span style={{ padding: "5px" }}>
                  <Button
                    bsSize="small"
                    bsStyle="success"
                    onClick={() =>
                      utils.addLabelToSelectedPoints(
                        props.plotlyLayout.annotations || [],
                        props.plotlySelectedEvent as Plotly.PlotSelectionEvent,
                        props.setPlotlySelectedEvent,
                        props.visibleLabels,
                        props.setVisibleLabels
                      )
                    }
                  >
                    Add
                  </Button>
                </span>
                <span style={{ padding: "5px" }}>
                  <Button
                    bsSize="small"
                    bsStyle="danger"
                    onClick={() =>
                      utils.removeLabelFromSelectedPoints(
                        props.plotlyLayout.annotations || [],
                        props.plotlySelectedEvent as Plotly.PlotSelectionEvent,
                        props.setPlotlySelectedEvent,
                        props.visibleLabels,
                        props.setVisibleLabels
                      )
                    }
                  >
                    Remove
                  </Button>
                </span>
              </div>
            )}
            {props.visibleLabels.size > 0 && (
              <div>Drag labels to reposition</div>
            )}
          </div>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};
