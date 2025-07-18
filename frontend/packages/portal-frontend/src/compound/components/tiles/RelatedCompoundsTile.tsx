import React from "react";
import { CorrelationBar } from "./CorrelationBar";

const data = {
  compound1: {
    CRISPR: { target1: 0.1, target2: 0.6 },
    RNAI: { target1: 0.7, target2: 0.2 },
  },
  compound2: {
    CRISPR: { target1: 0.4, target2: 0.5 },
    RNAI: { target1: 0.6, target2: 0.7 },
  },
};

type Data = typeof data;

const getDataTypes = (d: Data) => Object.keys(Object.values(d)[0]); // e.g., ['CRISPR', 'RNAI']

const getTargets = (d: Data, dataType: string) =>
  Object.keys(Object.values(d)[0][dataType]); // e.g., ['target1', 'target2']

const RelatedCompoundsTile = ({ datasetName }) => {
  const dataTypes = getDataTypes(data); // ['CRISPR', 'RNAI']
  const targetsByDataType = dataTypes.map((dataType) => ({
    dataType,
    targets: getTargets(data, dataType),
  }));
  const compoundNames = Object.keys(data);

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Related Compounds</h2>
        <h3 className="no_margin cardtitle_text">{datasetName}</h3>
        <div className="card_padding">
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ textAlign: "left", padding: "8px" }}>
                  Compound
                </th>
                {targetsByDataType.map(({ dataType, targets }) => (
                  <th
                    key={dataType}
                    colSpan={targets.length}
                    style={{ textAlign: "center", padding: "8px" }}
                  >
                    {dataType}
                  </th>
                ))}
              </tr>
              <tr>
                {targetsByDataType.flatMap(({ dataType, targets }) =>
                  targets.map((target) => (
                    <th
                      key={`${dataType}-${target}`}
                      style={{ textAlign: "center", padding: "8px" }}
                    >
                      {target}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {compoundNames.map((compound) => (
                <tr key={compound}>
                  <td style={{ padding: "8px", fontWeight: "bold" }}>
                    {compound}
                  </td>
                  {targetsByDataType.flatMap(({ dataType, targets }) =>
                    targets.map((target) => {
                      const value = data[compound][dataType][target];
                      return (
                        <td
                          key={`${compound}-${dataType}-${target}`}
                          style={{ padding: "4px" }}
                        >
                          <CorrelationBar correlation={value} />
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
};

export default RelatedCompoundsTile;
