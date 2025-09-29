/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../../styles/GeneTea.scss";
import { GeneTeaScatterPlotData } from "@depmap/types/src/experimental_genetea";
import AllTermsScatterPlot from "./AllTermsScatterPlot";

interface PlotSectionProps {
  isLoading: boolean;
  plotElement: ExtendedPlotType | null;
  data: GeneTeaScatterPlotData | null;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
}

function PlotSection({
  isLoading,
  data,
  handleSetPlotElement,
  plotElement,
}: PlotSectionProps) {
  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[
              PlotToolOptions.Zoom,
              PlotToolOptions.Pan,
              PlotToolOptions.Download,
            ]}
            onSearch={() => {}}
            searchOptions={null}
            searchPlaceholder=""
            downloadImageOptions={{
              filename: `genetea-all-terms-plot`,
              width: 1000,
              height: 600,
            }}
            onDownload={() => {}}
            altContainerStyle={{ backgroundColor: "#7B8CB2" }}
            hideCSVDownload
          />
        )}
      </div>
      <div className={styles.plotArea}>
        {isLoading && (
          <div className={styles.plotSpinnerContainer}>
            <PlotSpinner height="100%" />
          </div>
        )}
        {data && !isLoading && (
          <div className={styles.heatmapContainer}>
            <AllTermsScatterPlot
              data={data}
              handleSetPlotElement={handleSetPlotElement}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PlotSection);
