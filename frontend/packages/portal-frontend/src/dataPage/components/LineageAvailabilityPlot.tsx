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
  selectedDataType: string;
  data: LineageCountInfo;
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
  return (
    <Modal
      show={show}
      onHide={onCloseLineageModal}
      dialogClassName="custom-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-lg">Modal heading</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Wrapped Text</h4>
        <BarChart
          title="text title"
          categoryLabels={["skin", "bone"]}
          categoryValues={[50, 100]}
          onLoad={() => {}}
          customColors={["#86BDB5", "#2FA9D0"]}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCloseLineageModal}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LineageAvailabilityPlot;
