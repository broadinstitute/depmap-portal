import React, { useState } from "react";
import { satisfiesFilters } from "src/common/models/discoveryAppFilters";
import FilterControls from "src/common/components/FilterControls";
import Glossary from "src/common/components/Glossary";
import useDiscoveryAppFilters from "src/common/hooks/useDiscoveryAppFilters";
import useTargetDiscoveryHandlers from "src/tda/hooks/useTargetDiscoveryHandlers";
import useTargetDiscoveryData from "src/tda/hooks/useTargetDiscoveryData";
import filterDefinitions from "src/tda/json/filters.json";
import filterLayout from "src/tda/json/filterLayout.json";
import glossary from "src/tda/json/glossary.json";
import TargetDiscoveryHeader from "src/tda/components/TargetDiscoveryHeader";
import TargetDiscoveryPlot from "src/tda/components/TargetDiscoveryPlot";
import TargetDiscoveryTiles from "src/tda/components/TargetDiscoveryTiles";
import styles from "src/tda/styles/TDASummaryPage.scss";

function TDASummaryPage() {
  const { data, error } = useTargetDiscoveryData();
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const {
    filters,
    updateFilter,
    resetFilters,
    changedFilters,
  } = useDiscoveryAppFilters(data, filterDefinitions);

  const pointVisibility =
    filters && data ? satisfiesFilters(filters, data) : [];

  const { handleSearch, handleDownload } = useTargetDiscoveryHandlers(
    data,
    pointVisibility,
    setSelectedPoint
  );

  if (error) {
    throw new Error("Error fetching TDA data.");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <TargetDiscoveryHeader />
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
        <section className={styles.plot}>
          <TargetDiscoveryPlot
            data={data}
            pointVisibility={pointVisibility}
            selectedPoint={selectedPoint}
            onClickPoint={setSelectedPoint}
            onSearch={handleSearch}
            onDownload={handleDownload}
          />
        </section>
        <section className={styles.tiles}>
          <TargetDiscoveryTiles
            symbol={
              data && selectedPoint !== null ? data.symbol[selectedPoint] : null
            }
          />
        </section>
        <Glossary data={glossary} />
      </main>
    </div>
  );
}

export default TDASummaryPage;
