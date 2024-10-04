import React, { useMemo } from "react";
import {
  DataPageDataType,
  getDataPageDataTypeString,
  LineageCountInfo,
} from "../models/types";
import { Button, Modal } from "react-bootstrap";
import BarChart from "src/plot/components/BarChart";
import { DISEASE_COLORS } from "./utils";

interface LineageAvailabilityPlotProps {
  show: boolean;
  selectedDataType: DataPageDataType;
  data: LineageCountInfo[];
  onCloseLineageModal: () => void;
}

const LineageAvailabilityPlot = ({
  show,
  selectedDataType,
  data,
  onCloseLineageModal,
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
        (primaryDiseaseName: string, index: number) => {
          return {
            y: lineages,
            x: lineages.map(
              (lineageName: any) => data[lineageName][primaryDiseaseName]
            ), // Count of Primary Disease in each of these lineages
            name: primaryDiseaseName,
            type: "bar",
            orientation: "h",
            showlegend: false,
            hovertext: primaryDiseaseName,
            hoverinfo: "x+text",
            marker: { color: DISEASE_COLORS[index] },
          };
        }
      );
      return traceData;
    }

    return null;
  }, [data]);

  return (
    <Modal
      bsSize="large"
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
        <h4 style={{ marginBottom: "25px" }}>
          Hover over bars to see counts per Oncotree Primary Disease
        </h4>
        {formattedData && (
          <BarChart
            title=""
            data={formattedData}
            barmode={"stack"}
            height={25 * formattedData[0].y.length}
            onLoad={() => {}}
            xAxisTitle={"Count"}
            margin={{
              l: 180,

              r: 20,

              b: 30,

              t: 0,

              pad: 5,
            }}
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
