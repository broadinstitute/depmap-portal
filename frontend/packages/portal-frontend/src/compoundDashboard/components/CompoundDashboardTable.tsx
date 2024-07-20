import React, { useEffect, useState } from "react";
import WideTable from "@depmap/wide-table";
import { CompoundSummaryTable, CompoundSummaryTableRow } from "../models/types";
import styles from "../styles/CompoundDashboard.scss";
import { Filter } from "src/common/models/discoveryAppFilters";
import { getDatasetLabelFromId } from "../utils";

interface CompoundDashboardTableProps {
  datasetId: string;
  compoundData: CompoundSummaryTable | null;
  pointVisibility: boolean[];
  handleSelectRowAndPoint: (pointLabel: string) => void;
  handleChangeTableHistoSlider: (key: string, min: number, max: number) => void;
  selectedTableLabels: Set<string> | null;
  filters: Filter[] | null;
}

function CompoundDashboardTable(props: CompoundDashboardTableProps) {
  const {
    datasetId,
    compoundData,
    pointVisibility,
    handleSelectRowAndPoint,
    handleChangeTableHistoSlider,
    selectedTableLabels,
    filters,
  } = props;

  const [formattedData, setFormattedData] = useState<
    CompoundSummaryTableRow[] | undefined
  >();

  const [columns, setColumns] = useState<any>(undefined);

  const getTrProps = () => {
    const className = "striped-row";
    return {
      className,
    };
  };

  useEffect(() => {
    const iData = [];

    if (compoundData) {
      for (let index = 0; index < compoundData?.BroadID.length; index++) {
        const row = {
          BroadID: compoundData.BroadID[index],
          Name: compoundData.Name[index],
          Target: compoundData.Target[index],
          TargetOrMechanism: compoundData.TargetOrMechanism[index],
          Dose: compoundData.Dose[index],
          NumberOfSensitiveLines: compoundData.NumberOfSensitiveLines[index],
          BimodalityCoefficient: compoundData.BimodalityCoefficient[index],
          ModelType: compoundData.ModelType[index],
          PearsonScore: compoundData.PearsonScore[index],
          TopBiomarker: compoundData.TopBiomarker[index],
          Synonyms: compoundData.Synonyms[index],
        };

        iData.push(row);
      }
    }
    setFormattedData(iData);

    const renderFilterPlaceholder = ({
      column: { filterValue, setFilter },
    }: any) => {
      return (
        <input
          type="text"
          placeholder={`Search...`}
          value={filterValue || ""}
          onChange={(event) => setFilter(event.target.value || undefined)}
          style={{ width: "90%", fontSize: "12px" }}
        />
      );
    };

    const initialCols = [
      {
        accessor: "BroadID",
        id: "BroadID",
        Header: "BroadID",
        maxWidth: 800,
        minWidth: 90,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "Name",
        Header: "Name",
        maxWidth: 800,
        minWidth: 90,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "Target",
        Header: "Target",
        maxWidth: 1000,
        minWidth: 90,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "TargetOrMechanism",
        Header: "TargetOrMechanism",
        maxWidth: 240,
        minWidth: 140,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "Dose",
        Header: "Dose",
        maxWidth: 190,
        minWidth: 90,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "NumberOfSensitiveLines",
        Header: "# of Sensitive Lines",
        maxWidth: 120,
        minWidth: 90,
        useHistoSliderFilter: true,
      },
      {
        accessor: "BimodalityCoefficient",
        Header: "Bimodality Coefficient",
        maxWidth: 1000,
        minWidth: 120,
        useHistoSliderFilter: true,
        Cell: (row: any) => (row.value ? row.value.toFixed(3) : ""),
      },
      {
        accessor: "ModelType",
        Header: "Model Type",
        maxWidth: 1000,
        minWidth: 120,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "PearsonScore",
        Header: "Predictability Score",
        maxWidth: 1000,
        minWidth: 120,
        useHistoSliderFilter: true,
        Cell: (row: any) => (row.value ? row.value.toFixed(3) : ""),
      },
      {
        accessor: "TopBiomarker",
        Header: "Top Biomarker",
        maxWidth: 1000,
        minWidth: 120,
        customFilter: renderFilterPlaceholder,
      },
      {
        accessor: "Synonyms",
        Header: "Synonym",
        maxWidth: 1000,
        minWidth: 220,
        customFilter: renderFilterPlaceholder,
      },
    ];
    setColumns(initialCols);
  }, [compoundData, pointVisibility]);

  const handleChangeSelection = (selections: string[]) => {
    handleSelectRowAndPoint(selections[0]);
  };

  return (
    <section className={styles.compoundTable}>
      <div className={styles.tableHeader}>
        <h3>
          {getDatasetLabelFromId(datasetId)} Bimodality Coefficient and
          Predictability
        </h3>
        <h4>
          Filter this through row selection, text search. or value range to
          modify the plot above.
        </h4>
      </div>
      <div>
        {columns && (
          <WideTable
            idProp={"BroadID"}
            rowHeight={28}
            data={formattedData}
            columns={columns}
            defaultColumnsToShow={[
              "Name",
              "Target",
              "TargetOrMechanism",
              "Dose",
              "NumberOfSensitiveLines",
              "BimodalityCoefficient",
              "ModelType",
              "PearsonScore",
            ]}
            getTrProps={getTrProps}
            allowDownloadFromTableDataWithMenuFileName="prism-dashboard.csv"
            onChangeSelections={handleChangeSelection}
            selectedTableLabels={selectedTableLabels}
            onChangeHistoSlider={handleChangeTableHistoSlider}
            rowVisibility={pointVisibility}
            filters={filters}
            singleSelectionMode
            allowDownloadFromTableDataWithMenu
          />
        )}
      </div>
    </section>
  );
}

export default CompoundDashboardTable;
