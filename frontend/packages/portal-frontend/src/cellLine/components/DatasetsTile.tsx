import React, { Fragment } from "react";
import { Accordion } from "@depmap/interactive";
import { DatasetDataTypes } from "../models/types";

interface DatasetsTileProps {
  cellLineDatasets: DatasetDataTypes[];
}

const DatasetsTile = ({ cellLineDatasets }: DatasetsTileProps) => {
  return (
    <article className="card_wrapper datasets_tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Sequenced and profiled in the following datasets:
        </h2>
        <div className="card_padding">
          {cellLineDatasets.map((datasetDataType, i) => (
            <Fragment key={i}>
              {" "}
              {datasetDataType.datasets.length > 0 && (
                <Accordion
                  key={datasetDataType.toString()}
                  title={`${datasetDataType.dataType} (${datasetDataType.datasets.length} datasets)`}
                >
                  {datasetDataType.datasets.map((dataset) => (
                    <p
                      className="accordion_contents"
                      key={dataset.display_name}
                    >
                      <a href={dataset.download_url}>{dataset.display_name}</a>
                    </p>
                  ))}
                </Accordion>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </article>
  );
};

export default DatasetsTile;
