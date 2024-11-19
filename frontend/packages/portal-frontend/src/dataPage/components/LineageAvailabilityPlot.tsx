import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataPageDataType,
  getDataPageDataTypeString,
  LineageAvailability,
  LineageCountInfo,
} from "../models/types";
import { Button, Modal } from "react-bootstrap";
import BarChart from "src/plot/components/BarChart";
import { DISEASE_COLORS } from "./utils";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { getDapi } from "src/common/utilities/context";

interface LineageAvailabilityPlotProps {
  show: boolean;
  selectedDataType: DataPageDataType;
  onCloseLineageModal: () => void;
}

const LineageAvailabilityPlot = ({
  show,
  selectedDataType,
  onCloseLineageModal,
}: LineageAvailabilityPlotProps) => {
  const dapi = getDapi();
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  // On open of a datatype's model count on the right side of the data availability
  // plot, fetch the lineageAvail data and setLineageAvail
  const [lineageAvail, setLineageAvail] = useState<LineageCountInfo | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<LineageAvailability>>();

  useEffect(() => {
    setLineageAvail(null);
    setIsLoading(true);
    const promise = dapi.getLineageDataAvailability(selectedDataType);

    latestPromise.current = promise;
    promise
      .then((result: any) => {
        if (promise === latestPromise.current) {
          if (result.error || Object.keys(result.lineage_counts).length === 0) {
            setIsError(true);
            setIsLoading(false);
          } else {
            setLineageAvail(result.lineage_counts);
          }
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (promise === latestPromise.current) {
          window.console.error(e);
          setIsError(true);
        }
      });

    return () => {
      setLineageAvail(null);
    };
  }, [selectedDataType, show, dapi]);

  // For each primary disease
  // Make a trace with the primary disease as the value of trace.name
  // The trace y should be the list of all lineages.
  // The trace x should be the count of THIS primary disease in each lineage.
  const formattedData = useMemo(() => {
    if (lineageAvail) {
      const lineages = [...Object.keys(lineageAvail)].sort((a, b) =>
        b.localeCompare(a)
      );

      let allPrimaryDiseases: string[] = [];
      lineages.forEach((lineageName: string) => {
        const primaryDiseases = Object.keys(
          lineageAvail[lineageName]
        ) as string[];
        allPrimaryDiseases = allPrimaryDiseases.concat(primaryDiseases);
      });

      const uniquePrimaryDiseases = new Set(allPrimaryDiseases);

      const traceData = ([...uniquePrimaryDiseases] as string[]).map(
        (primaryDiseaseName: any, index: number) => {
          return {
            y: lineages,
            x: lineages.map(
              (lineageName: any) =>
                lineageAvail[lineageName][primaryDiseaseName]
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
  }, [lineageAvail]);

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
        {isError && (
          <h2>Sorry, there was an error fetching lineage availability data.</h2>
        )}
        {!isError && (
          <>
            <h4 style={{ marginBottom: "25px" }}>
              Hover over bars to see counts per Oncotree Primary Disease
            </h4>
            {!plotElement && isLoading && <PlotSpinner />}
            {formattedData && (
              <BarChart
                title=""
                data={formattedData}
                barmode={"stack"}
                height={
                  formattedData[0].y.length > 3
                    ? 25 * formattedData[0].y.length
                    : 80 * formattedData[0].y.length
                }
                onLoad={(element: ExtendedPlotType | null) => {
                  setPlotElement(element);
                }}
                xAxisTitle={"Count"}
                margin={{
                  l: 180,

                  r: 20,

                  b: 50,

                  t: 0,

                  pad: 5,
                }}
              />
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCloseLineageModal}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LineageAvailabilityPlot;
