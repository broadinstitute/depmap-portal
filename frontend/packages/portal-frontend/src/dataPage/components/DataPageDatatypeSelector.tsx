import React from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import { DataPageDataType, getDataPageDataTypeString } from "../models/types";
import { BAR_THICKNESS, currentReleaseDatasets } from "./utils";

interface Props {
  datatypes: string[];
  dataTypeGroupName: string;
  dataTypeUrlMapping: { [key: string]: string | undefined };
  drugCountMapping: { [data_type: string]: number | undefined };
  isCurrentRelease: boolean;
}

const DataPageDatatypeSelector = ({
  datatypes,
  dataTypeGroupName,
  dataTypeUrlMapping,
  drugCountMapping,
  isCurrentRelease,
}: Props) => {
  const display: any = [];

  const getDrugCountLabel = (dataType: string) => {
    if (
      Object.keys(drugCountMapping).includes(dataType) &&
      drugCountMapping[dataType] !== null &&
      drugCountMapping[dataType] !== undefined
    ) {
      return `(${drugCountMapping[dataType]} drugs)`;
    }

    return "";
  };

  // If the data type is in the current release, add an asterisk.
  const getDataTypeLabel = (
    dataType: string,
    dataTypeIsInCurrentRelease: boolean
  ) => {
    if (!isCurrentRelease && dataTypeIsInCurrentRelease) {
      const asteriskLabelDataType = dataType.concat("*");

      return asteriskLabelDataType;
    }

    return dataType;
  };
  datatypes.forEach((datatype: string) => {
    const dataTypeDisplayName = getDataPageDataTypeString(
      datatype as DataPageDataType
    );
    const inCurrentRelease = currentReleaseDatasets.includes(datatype);

    display.push(
      <div className={styles.selector} key={`wapper-${dataTypeDisplayName}`}>
        {Object.keys(dataTypeUrlMapping).includes(dataTypeDisplayName) &&
        dataTypeUrlMapping[dataTypeDisplayName] !== null &&
        dataTypeUrlMapping[dataTypeDisplayName] !== undefined ? (
          <a
            href={dataTypeUrlMapping[dataTypeDisplayName]}
            target="_blank"
            rel="noreferrer"
          >
            {`${getDataTypeLabel(dataTypeDisplayName, inCurrentRelease)}`}
            <br />
            {getDrugCountLabel(dataTypeDisplayName)}
          </a>
        ) : (
          <p>
            {getDataTypeLabel(dataTypeDisplayName, inCurrentRelease)} <br />
            {getDrugCountLabel(dataTypeDisplayName)}
          </p>
        )}
      </div>
    );
  });
  return (
    <div className={styles.datatypeSelector}>
      <div className={styles.groupContainer}>
        {" "}
        {dataTypeGroupName && (
          <div className={styles.groupLabel}>{dataTypeGroupName}</div>
        )}
        <div
          style={{
            gridColumn: "2",
            display: "grid",
            alignItems: "center",
            gridTemplateRows: `repeat(${datatypes.length}, ${BAR_THICKNESS}px)`,
          }}
        >
          {display}
        </div>
      </div>
    </div>
  );
};

export default DataPageDatatypeSelector;
