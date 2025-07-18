import React from "react";
import { CorrelationBar } from "./CorrelationBar";
// Reusable style for truncation + tooltip
const ellipsisStyle: React.CSSProperties = {
  maxWidth: "30%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const data = {
  superlongcompoundname1: {
    CRISPR: { superlongtargetname1: 0.1, target2: 0.6 },
    RNAI: { superlongtargetname1: 0.7, target2: 0.2 },
  },
  compound2: {
    CRISPR: { superlongtargetname1: 0.4, target2: 0.5 },
    RNAI: { superlongtargetname1: 0.6, target2: 0.7 },
  },
};

type Data = typeof data;

const getDataTypes = (d: Data) => Object.keys(Object.values(d)[0]); // e.g., ['CRISPR', 'RNAI']

const getTargets = (d: Data, dataType: string) =>
  Object.keys(Object.values(d)[0][dataType]); // e.g., ['target1', 'target2']

interface RelatedCompoundsTileProps {
  entityLabel: string;
}

const RelatedCompoundsTile = ({ entityLabel }: RelatedCompoundsTileProps) => {
  const datasetName = "OncRef Dataset"; // This would typically come from props or context
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
          <table style={{ width: "100%", tableLayout: "fixed" }}>
            {" "}
            {/* use fixed layout so column widths are based on width/maxWidth, not content size */}
            <thead>
              <tr>
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                <th rowSpan={2} style={{ textAlign: "left", padding: "8px" }} />
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
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        ...ellipsisStyle,
                      }}
                      title={target} // Tooltip for full name
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
                  <td
                    style={{
                      padding: "4px",
                      fontWeight: "bold",
                      ...ellipsisStyle,
                    }}
                    title={compound}
                  >
                    {" "}
                    {/* title: Tooltip for full name */}
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
