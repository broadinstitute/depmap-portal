import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import { CustomList } from "@depmap/cell-line-selector";
import { AnalysisType, ComputeResponseResult } from "@depmap/compute";
import { ControlledPlotState, Link } from "@depmap/interactive";
import { getDataExplorer2Url } from "../utils";
import styles from "../styles/CustomAnalysis.scss";

interface Props {
  results: Partial<ControlledPlotState> | undefined;
  analysisType: AnalysisType | undefined;
  queryComponents: Partial<
    Record<
      AnalysisType,
      {
        state: {
          vectorCatalogSelections?: Link[];
          inGroup: CustomList;
          outGroup: CustomList;
          selectedList: CustomList;
        };
      }
    >
  >;
}

function ResultsReadyModal({ results, analysisType, queryComponents }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!results || !analysisType || !queryComponents) {
      return;
    }

    const vectorCatalogSelections = queryComponents[analysisType]!.state
      .vectorCatalogSelections;

    const { inGroup, outGroup, selectedList } = queryComponents[
      analysisType
    ]!.state;
    const cellLineLists = { inGroup, outGroup, selectedList };

    getDataExplorer2Url(
      results.customAnalysisResult!.type as AnalysisType,
      results.customAnalysisResult!.result as ComputeResponseResult,
      cellLineLists,
      vectorCatalogSelections
    ).then(setUrl);
  }, [results, analysisType, queryComponents]);

  return (
    <Modal backdrop="static" show={Boolean(url)} onHide={() => setUrl(null)}>
      <Modal.Header closeButton>
        <Modal.Title>Results ready</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.resultsModal}>
        <span className="glyphicon glyphicon-ok-circle" />
        <p>Custom analysis results are ready to view in Data Explorer.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => setUrl(null)}>Cancel</Button>
        <Button
          bsStyle="info"
          onClick={() => {
            navigate(`${location.pathname}/..`, { state: results });
          }}
        >
          Open in Data Explorer 1
        </Button>
        <Button
          bsStyle="primary"
          onClick={() => {
            window.open(url as string, "_blank");
            setUrl(null);
          }}
        >
          Open in Data Explorer 2
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ResultsReadyModal;
