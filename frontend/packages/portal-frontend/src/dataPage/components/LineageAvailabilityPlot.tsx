import React, { useCallback, useMemo } from "react";
import Heatmap from "src/plot/components/Heatmap";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  COLOR_SCALE,
  DataAvailability,
  DataPageDataType,
  DataPageDataTypeCategoryStrings,
  getDataPageDataTypeColorCategoryString,
  getDataPageDataTypeString,
  LineageCountInfo,
} from "../models/types";
import styles from "src/dataPage/styles/DataPage.scss";
import DataPageDatatypeSelector from "./DataPageDatatypeSelector";
import { BAR_THICKNESS, getFileUrl } from "./utils";
import { Button, Modal } from "react-bootstrap";
import BarChart from "src/plot/components/BarChart";

interface LineageAvailabilityPlotProps {
  show: boolean;
  selectedDataType: DataPageDataType;
  data: LineageCountInfo[];
  onCloseLineageModal: () => void;
  handleSetPlotElement: (element: any) => void;
  plotElement: ExtendedPlotType | null;
}

const LineageAvailabilityPlot = ({
  show,
  selectedDataType,
  data,
  onCloseLineageModal,
  handleSetPlotElement,
  plotElement,
}: LineageAvailabilityPlotProps) => {
  // For each primary disease
  // Make a trace with the primary disease as the value of trace.name
  // The trace y should be the list of all lineages.
  // The trace x should be the count of THIS primary disease in each lineage.

  const formattedData = useMemo(() => {
    if (data) {
      const lineages = Object.keys(data);

      let allPrimaryDiseases: string[] = [];
      lineages.forEach((lineageName: any) => {
        const primaryDiseases = Object.keys(data[lineageName]);
        allPrimaryDiseases = allPrimaryDiseases.concat(primaryDiseases);
      });

      const uniquePrimaryDiseases = new Set(allPrimaryDiseases);

      const traceData = [...uniquePrimaryDiseases].map(
        (primaryDiseaseName: string) => {
          return {
            y: lineages,
            x: lineages.map(
              (lineageName: any) => data[lineageName][primaryDiseaseName]
            ), // Count of Primary Disease in each of these lineages
            name: primaryDiseaseName,
            type: "bar",
            orientation: "h",
          };
        }
      );
      return traceData;
    }

    return null;
  }, [data]);

  return (
    <Modal
      show={show}
      onHide={onCloseLineageModal}
      dialogClassName="custom-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-lg">
          Models with {getDataPageDataTypeString(selectedDataType)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Hover over bars to see counts per Oncotree Primary Disease</h4>
        {formattedData && (
          <BarChart
            title="text title"
            data={formattedData}
            barmode={"stack"}
            onLoad={() => {}}
            customColors={[["#86BDB5"], ["#2FA9D0"]]}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCloseLineageModal}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LineageAvailabilityPlot;
