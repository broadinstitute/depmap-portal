import React from "react";
import { Checkbox } from "react-bootstrap";

import { DatasetOptionsWithLabels } from "../models";

interface Props {
  datasets: DatasetOptionsWithLabels[];
  onClick: (clickedOption: DatasetOptionsWithLabels) => void;
  onMouseOver: (mousedDataset: string) => void;
  checked: ReadonlySet<string>;
  highlightedDataset: string;
}

const DatasetPicker = (props: Props) => {
  const { datasets, highlightedDataset, onMouseOver, checked, onClick } = props;

  const display: any = [];
  datasets.forEach((dataset: DatasetOptionsWithLabels) => {
    let className = "datasetSelector";
    if (highlightedDataset === dataset.id) {
      className += " highlighted";
    }
    display.push(
      <div
        className={className}
        key={`checkboxWrapper-${dataset.id}`}
        onMouseOver={() => {
          onMouseOver(dataset.id);
        }}
        onFocus={() => {
          onMouseOver(dataset.id);
        }}
      >
        <Checkbox
          key={`checkbox-${dataset.label}-${dataset.id}`}
          style={{ width: "100%" }}
          checked={checked.has(dataset.id)}
          onChange={() => {
            onClick(dataset);
          }}
        >
          <span style={{ width: "100%" }}>{dataset.label}</span>
          {dataset.url && (
            <a
              href={dataset.url.concat("&tab=allData")}
              target="_blank"
              rel="noreferrer"
            >
              <span
                className="glyphicon glyphicon-new-window"
                style={{ paddingLeft: "3px" }}
              />
            </a>
          )}
        </Checkbox>
      </div>
    );
  });
  return <div>{display}</div>;
};

export default DatasetPicker;
