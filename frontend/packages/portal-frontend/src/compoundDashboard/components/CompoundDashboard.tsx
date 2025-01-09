import React, { useCallback, useEffect, useMemo, useState } from "react";
import { downloadCsv } from "@depmap/utils";
import { satisfiesFilters } from "src/common/models/discoveryAppFilters";
import Glossary from "src/common/components/Glossary";
import FilterControls from "src/common/components/FilterControls";
import useDiscoveryAppHandlers from "src/common/hooks/useDiscoveryAppHandlers";
import useDiscoveryAppFilters from "src/common/hooks/useDiscoveryAppFilters";
import useCompoundDashboardData from "../hooks/useCompoundDashboardData";
import { CompoundSummaryTable, DatasetId } from "../models/types";
import filterLayout from "../json/filterLayout.json";
import CompoundDashboardHeader from "./CompoundDashboardHeader";
import CompoundDashboardPlot from "./CompoundDashboardPlot";
import CompoundDashboardTiles from "./CompoundDashboardTiles";
import styles from "../styles/CompoundDashboard.scss";
import filterDefinitions from "../json/filters.json";
import glossary from "src/compoundDashboard/json/glossary.json";
import { Radio } from "react-bootstrap";
import CompoundDashboardTable from "./CompoundDashboardTable";
import { GlossaryItem } from "src/common/components/Glossary/types";
import { CompoundDashboardView } from "./CompoundDashboardColumnControls";

function CompoundDashboard() {
  const [datasetId, setDatasetId] = useState<DatasetId>("Rep_all_single_pt");
  const { data, error } = useCompoundDashboardData(datasetId);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [viewSelection, setViewSelection] = useState<CompoundDashboardView>(
    CompoundDashboardView.Plot
  );
  const {
    filters,
    updateFilter,
    resetFilters,
    changedFilters,
  } = useDiscoveryAppFilters(data, filterDefinitions);

  // When a plot point is selected, filter the table down to that single row via
  // using the array to determine pointVisbility. If a plot point is not selected, this
  // should always be null.
  const [pointVisibilityFiltered, setPointVisibilityFiltered] = useState<
    boolean[] | null
  >(null);

  useEffect(() => {
    setSelectedPoint(null);
    setPointVisibilityFiltered(null);
  }, [datasetId]);

  const pointVisibility = useMemo(
    () => (filters && data ? satisfiesFilters(filters, data) : []),
    [filters, data]
  );

  const [
    selectedTableLabels,
    setSelectedTableLabels,
  ] = useState<Set<string> | null>(null);

  const { handleSearch } = useDiscoveryAppHandlers(
    data,
    pointVisibility,
    setSelectedPoint,
    setPointVisibilityFiltered,
    setSelectedTableLabels,
    "BroadID"
  );

  const handleDownload = useCallback(
    (xKey: string, yKey: string) => {
      if (!data) {
        return;
      }

      downloadCsv(
        data,
        "BroadID",
        "compounds-filitered.csv",
        pointVisibility.map(
          (visible, i) =>
            visible &&
            // filter out any rows that aren't currently visualized
            // because the data are missing for the plot's selected columns
            typeof data[xKey as keyof CompoundSummaryTable][i] === "number" &&
            typeof data[yKey as keyof CompoundSummaryTable][i] === "number"
        )
      );
    },
    [data, pointVisibility]
  );

  if (error) {
    throw new Error("Error fetching compound dashboard data.");
  }

  const handleChangeTableHistoSlider = useCallback(
    (key: string, min: number, max: number) => {
      updateFilter(key, [min, max]);
    },
    [updateFilter]
  );

  const handleSelectRowAndPoint = useCallback(
    (pointLabel: string) => {
      if (data) {
        const label = pointLabel;

        setSelectedTableLabels((xs) => {
          let ys = new Set(xs);

          if (!label) {
            return new Set();
          }

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);
          }

          return ys;
        });

        setPointVisibilityFiltered(null);

        setSelectedPoint(pointLabel ? data.BroadID.indexOf(pointLabel) : null);
      }
    },
    [data, setSelectedTableLabels, setSelectedPoint]
  );

  const handleClickPoint = useCallback(
    (pointIndex: number) => {
      if (data) {
        const label = pointIndex ? data.BroadID[pointIndex] : null;

        if (selectedPoint !== pointIndex) {
          setSelectedPoint(pointIndex);

          // Filter the table to 1 row so the user doesn't have to
          // scroll to find the row corresponding to the point they just selected.
          const filteredVisibility = Array(data.Name.length).fill(false);

          filteredVisibility[pointIndex] = true;
          setPointVisibilityFiltered(filteredVisibility);
        } else {
          setSelectedPoint(null);
          setPointVisibilityFiltered(null);
        }

        setSelectedTableLabels((xs) => {
          let ys = new Set(xs);

          if (!label) {
            return new Set();
          }

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);
          }

          return ys;
        });
      }
    },
    [data, setSelectedTableLabels, setSelectedPoint, selectedPoint]
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <CompoundDashboardHeader />
      </header>
      <main className={styles.main}>
        <section className={styles.filters}>
          <FilterControls
            data={data}
            filters={filters}
            changedFilters={changedFilters}
            layout={filterLayout}
            onChangeFilter={updateFilter}
            onClickReset={resetFilters}
          />
        </section>
        <section
          className={
            viewSelection === CompoundDashboardView.Plot || !viewSelection
              ? styles.plot
              : styles.tableAndPlot
          }
        >
          <div>
            <span
              style={{
                marginLeft: "10px",
                marginRight: "10px",
                color: "#585858",
              }}
            >
              VIEW
            </span>
            <Radio
              style={{ marginBottom: "3px" }}
              name="radioGroup"
              checked={viewSelection === CompoundDashboardView.Plot}
              onChange={() => {
                setViewSelection(CompoundDashboardView.Plot);
              }}
              inline
            >
              Plot
            </Radio>
            <Radio
              style={{ marginBottom: "3px" }}
              name="radioGroup"
              checked={viewSelection === CompoundDashboardView.TableAndPlot}
              onChange={() => {
                setViewSelection(CompoundDashboardView.TableAndPlot);
              }}
              inline
            >
              Table and Plot
            </Radio>
            <Radio
              style={{ marginBottom: "3px" }}
              name="radioGroup"
              checked={viewSelection === CompoundDashboardView.TableOnly}
              onChange={() => {
                setViewSelection(CompoundDashboardView.TableOnly);
              }}
              inline
            >
              Table Only
            </Radio>
          </div>
          <CompoundDashboardPlot
            datasetId={datasetId}
            onChangeDatasetId={setDatasetId}
            data={data}
            pointVisibility={pointVisibility}
            selectedPoint={selectedPoint}
            handleClickPoint={handleClickPoint}
            onSearch={handleSearch}
            onDownload={handleDownload}
            viewSelection={viewSelection}
          />
          {(viewSelection === CompoundDashboardView.TableOnly ||
            viewSelection === CompoundDashboardView.TableAndPlot) && (
            <CompoundDashboardTable
              datasetId={datasetId}
              compoundData={data}
              pointVisibility={pointVisibilityFiltered ?? pointVisibility}
              handleSelectRowAndPoint={handleSelectRowAndPoint}
              handleChangeTableHistoSlider={handleChangeTableHistoSlider}
              selectedTableLabels={selectedTableLabels}
              filters={filters}
            />
          )}
        </section>
        <section className={styles.tiles}>
          <CompoundDashboardTiles
            compound={
              data && selectedPoint !== null ? data.Name[selectedPoint] : null
            }
            datasetId={datasetId}
          />
        </section>
        <Glossary data={glossary as GlossaryItem[]} />
      </main>
    </div>
  );
}

export default CompoundDashboard;
