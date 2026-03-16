import React from "react";
import styles from "../CompoundTiles.scss";

export const TopModelsTable: React.FC<{ models: any[] }> = ({ models }) => (
  <table style={{ width: "100%" }}>
    <thead>
      <tr>
        <th />
        <th>
          Prediction
          <br />
          Accuracy
        </th>
        <th>
          Feature
          <br />
          ID
        </th>
        <th>
          Feature
          <br />
          Type
        </th>
        <th>
          Feature
          <br />
          Set
        </th>
      </tr>
    </thead>
    <tbody>
      {models.map((model, index) => (
        <tr key={index}>
          <td>{index + 1}.</td>
          <td>{model.model_pearson}</td>
          <td>{model.feature_name}</td>
          <td>{model.feature_type}</td>
          <td>{model.model_label}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
