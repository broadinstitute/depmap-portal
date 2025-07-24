import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { legacyPortalAPI } from "@depmap/api";
import {
  CellData,
  loadCellLines,
  LongTableCellLineSelector,
  SaveConfirmationModal,
} from "@depmap/cell-line-selector";
import { Spinner } from "@depmap/common-components";
import ContextNameForm from "../ContextNameForm";
import styles from "../../../styles/ContextBuilder.scss";

interface Props {
  mode: "edit" | "create";
  initialSelection: ReadonlySet<string>;
  useModelNames: boolean;
  onSelect: (updatedList: string[], contextName?: string) => void;
  onCancel: () => void;
}

type ColorMaps = Map<string, Map<string, string>>;

const modelNamesToIDs = (names: ReadonlySet<string>, tableData: CellData[]) => {
  const values = [...names].map((displayName) => {
    const element = tableData.find((d) => d.displayName === displayName);
    return element ? element.depmapId : "unknown";
  });

  return new Set(values);
};

const modelIDstoNames = (ids: ReadonlySet<string>, tableData: CellData[]) => {
  const values = [...ids].map((depmapId) => {
    const element = tableData.find((d) => d.depmapId === depmapId);
    return element ? element.displayName : "unknown";
  });

  return new Set(values);
};

const setsAreEqual = (
  setA: ReadonlySet<unknown>,
  setB: ReadonlySet<unknown>
) => {
  if (setA == null || setB == null || setA.size !== setB.size) {
    return false;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const a of setA) {
    if (!setB.has(a)) {
      return false;
    }
  }

  return true;
};

function CellLineSelectorModal({
  mode,
  initialSelection,
  useModelNames,
  onSelect,
  onCancel,
}: Props) {
  const [tableData, setTableData] = useState<CellData[] | null>();
  const [colorMaps, setColorMaps] = useState<ColorMaps | null>(null);
  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);
  const [contextName, setContextName] = useState<string | undefined>(undefined);
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const [shouldShowConfirmation, setShouldShowConfirmation] = useState(false);
  const [selection, setSelection] = useState(
    useModelNames ? new Set<string>() : initialSelection
  );
  const [linesSelectedAndHidden, setLinesSelectedAndHidden] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    legacyPortalAPI.getCellLineSelectorLines().then((cellLines) => {
      const cellLineData = loadCellLines(cellLines);
      const td = [...cellLineData.values()];
      setTableData(td);

      if (useModelNames) {
        setSelection(modelNamesToIDs(initialSelection, td));
      }
    });
  }, [useModelNames, initialSelection]);

  useEffect(() => {
    legacyPortalAPI.getCellignerColorMap().then((colorsObj) => {
      const lineageMap = new Map<string, string>();
      const diseaseMap = new Map<string, string>();
      const numEntries = colorsObj.color.length;

      for (let i = 0; i < numEntries; i++) {
        lineageMap.set(colorsObj.lineage[i], colorsObj.color[i]);
        diseaseMap.set(colorsObj.primaryDisease[i], colorsObj.color[i]);
      }

      const maps = new Map<string, Map<string, string>>([
        ["lineage", lineageMap],
        ["primaryDisease", diseaseMap],
      ]);

      setColorMaps(maps);
    });
  }, []);

  useEffect(() => {
    legacyPortalAPI.getCellLineUrlRoot().then(setCellLineUrlRoot);
  }, []);

  const isLoading = !tableData || !colorMaps || !cellLineUrlRoot;

  const handleClickSave = (linesToSave: ReadonlySet<string>) => {
    setShouldShowValidation(true);

    if (mode === "create" && !contextName) {
      return;
    }

    if (linesSelectedAndHidden.size > 0 && !shouldShowConfirmation) {
      setShouldShowConfirmation(true);
      return;
    }

    onSelect(
      [
        ...(useModelNames
          ? modelIDstoNames(linesToSave, tableData as CellData[])
          : linesToSave),
      ],
      contextName
    );
  };

  return (
    <>
      <Modal
        className={styles.CellLineSelectorModal}
        backdrop={false}
        show
        onHide={onCancel}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {mode === "edit" ? "Edit Cell Line List" : "Create a Model Context"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoading ? (
            <div className={styles.foo}>
              <Spinner left="0px" position="static" />
            </div>
          ) : (
            <>
              {mode === "create" && (
                <ContextNameForm
                  className={styles.cellLineContextName}
                  value={contextName}
                  onChange={setContextName}
                  onSubmit={() => handleClickSave(selection)}
                  shouldShowValidation={shouldShowValidation}
                />
              )}
              <LongTableCellLineSelector
                idCol="depmapId"
                frozenCols={["displayName"]}
                initialData={tableData}
                defaultChecked={
                  useModelNames
                    ? modelNamesToIDs(initialSelection, tableData)
                    : initialSelection
                }
                cellLineUrlRoot={cellLineUrlRoot}
                colorMaps={colorMaps}
                onCheckboxClick={setSelection}
                onLongTableFilterChange={(visibleLines: string[]) => {
                  const hiddenLines = new Set(selection);

                  visibleLines.forEach((line: string) => {
                    hiddenLines.delete(line);
                  });

                  setLinesSelectedAndHidden(hiddenLines);
                }}
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button id="cancel-edit-cell-line-list" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            id="keep-cell-line-list-changes"
            bsStyle="primary"
            onClick={() => handleClickSave(selection)}
            disabled={
              isLoading ||
              setsAreEqual(
                initialSelection,
                useModelNames
                  ? modelIDstoNames(selection, tableData as CellData[])
                  : selection
              )
            }
          >
            {mode === "edit" ? "Keep changes" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <SaveConfirmationModal
        show={shouldShowConfirmation}
        onHide={() => setShouldShowConfirmation(false)}
        linesSelected={selection}
        linesSelectedAndHidden={linesSelectedAndHidden}
        onSaveButtonClick={() => handleClickSave(selection)}
        onSaveFilteredLines={() => {
          const visibleLines = new Set(selection);

          linesSelectedAndHidden.forEach((line: string) => {
            visibleLines.delete(line);
          });

          handleClickSave(visibleLines);
        }}
        formatCellLines={(cellLines) => {
          const lines = new Set(cellLines);
          const data = (tableData as CellData[]).filter((row) => {
            return lines.has(row.depmapId);
          });

          return (
            <ul>
              {data.map((line) => (
                <li key={line.displayName}>
                  <a href={`${cellLineUrlRoot}${line.depmapId}`}>
                    {line.displayName}
                  </a>
                </li>
              ))}
            </ul>
          );
        }}
      />
    </>
  );
}

export default CellLineSelectorModal;
