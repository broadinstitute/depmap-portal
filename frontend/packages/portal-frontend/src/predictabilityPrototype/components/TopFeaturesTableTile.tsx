import React from "react";
import { Table } from "react-bootstrap";
import PlotSpinner from "src/plot/components/PlotSpinner";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { GeneTeaSearchTerm } from "../models/types";

export interface TopFeaturesTableProps {
  selectedLabels: GeneTeaSearchTerm[] | null;
}

const TopFeaturesTable = ({ selectedLabels }: TopFeaturesTableProps) => {
  if (selectedLabels) {
    return (
      <>
        {!selectedLabels && <PlotSpinner height="100%" />}
        <h4>{selectedLabels.length} total search terms</h4>
        <div
          style={{
            maxHeight: "400px",
            overflow: "scroll",
            border: "1px solid lightgrey",
          }}
        >
          {" "}
          <Table responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Feature Type</th>
                <th>Importance Rank</th>
              </tr>
            </thead>
            <tbody>
              {selectedLabels.map((label, i) => (
                <tr key={i}>
                  <td>{label.name}</td>
                  <td>{label.feature_type}</td>
                  <td>{label.importance_rank}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </>
    );
  }
  return null;
};

export default TopFeaturesTable;
