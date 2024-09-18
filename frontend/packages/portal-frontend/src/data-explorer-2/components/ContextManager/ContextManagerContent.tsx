import React, { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { Button, Modal } from "react-bootstrap";
import { DataExplorerContext } from "@depmap/types";
import {
  ContextBuilderModal,
  fetchContext,
  loadContextsFromLocalStorage,
  persistLegacyListAsContext,
  useCellLineSelectorModal,
} from "@depmap/data-explorer-2";
import {
  deleteContextFromLocalStorage,
  saveContextToLocalStorage,
} from "src/data-explorer-2/utils";
import { LocalStorageListStore } from "@depmap/cell-line-selector";
import Welcome from "src/data-explorer-2/components/ContextManager/Welcome";
import ContextListItem from "src/data-explorer-2/components/ContextManager/ContextListItem";
import ContextTypeSelect from "src/data-explorer-2/components/ContextManager/ContextTypeSelect";
import useDownloadContextModal from "src/data-explorer-2/components/ContextManager/DownloadContextModal";
import { confirmDeleteContext } from "src/data-explorer-2/components/ContextManager/context-manager-utils";
import styles from "src/data-explorer-2/styles/ContextManager.scss";

interface Props {
  onHide: () => void;
  showHelpText: boolean;
  initialContextType?: string;
}

function ContextManagerContent({
  onHide,
  showHelpText,
  initialContextType = "depmap_model",
}: Props) {
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextType, setContextType] = useState(initialContextType);
  const [, forceRender] = useState({});
  const contextToEdit = useRef<DataExplorerContext | null>(null);
  const onClickSave = useRef<(context: DataExplorerContext) => void>(() => {
    throw new Error("`onClickSave` callback has not been defined");
  });
  const contextListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let modal = document.querySelector("#modal-container") as HTMLElement;

    if (!modal) {
      modal = document.createElement("div");
      document.body.appendChild(modal);
    }

    modal.id = "modal-container";
    modal.style.zIndex = "1051";
    modal.style.position = "absolute";
    modal.style.top = "0";
  }, []);

  const {
    CellLineSelectorModal,
    isCellLineSelectorVisible,
    createNewInCellLineSelector,
  } = useCellLineSelectorModal();

  const {
    DownloadContextModal,
    isDownloadContextModalVisible,
    showDownloadContextModal,
  } = useDownloadContextModal();

  const contexts = loadContextsFromLocalStorage(contextType);

  const openContextEditor = (
    hash: string | null,
    context: Partial<DataExplorerContext>
  ) => {
    contextToEdit.current = context as DataExplorerContext;

    onClickSave.current = async (editedContext: DataExplorerContext) => {
      try {
        const nextHash = await saveContextToLocalStorage(editedContext, hash);
        setShowContextModal(false);
        window.dispatchEvent(new Event("dx2_contexts_updated"));

        if (context.name) {
          window.dispatchEvent(
            new CustomEvent("dx2_context_edited", {
              detail: {
                prevContext: context,
                nextContext: editedContext,
                prevHash: hash,
                nextHash,
              },
            })
          );
        }
      } catch (e) {
        // eslint-disable-next-line no-alert
        window.alert("Sorry, there was a problem saving your context.");
        setShowContextModal(false);
        window.console.error(e);
      }
    };

    setShowContextModal(true);
  };

  const handleClickEdit = async (
    hashOrLegacyListName: string,
    isLegacyList: boolean
  ) => {
    let hash;
    let context;

    if (isLegacyList) {
      [hash, context] = await persistLegacyListAsContext(hashOrLegacyListName);
    } else {
      hash = hashOrLegacyListName;
      context = await fetchContext(hash);
    }

    openContextEditor(hash, context);
  };

  const handleClickDuplicate = async (
    hashOrLegacyListName: string,
    isLegacyList: boolean
  ) => {
    let context;

    if (isLegacyList) {
      [, context] = await persistLegacyListAsContext(hashOrLegacyListName);
    } else {
      context = await fetchContext(hashOrLegacyListName);
    }

    const duplicateContext = {
      ...context,
      name: `Copy of ${context.name}`,
    };

    await saveContextToLocalStorage(duplicateContext);
    window.dispatchEvent(new Event("dx2_contexts_updated"));
    forceRender({});

    setTimeout(() => {
      contextListRef.current?.scroll({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const handleClickDelete = async (
    hash: string,
    contextName: string,
    isLegacyList: boolean
  ) => {
    const confirmed = await confirmDeleteContext(contextName);

    if (confirmed) {
      if (isLegacyList) {
        const store = new LocalStorageListStore();
        store.delete(hash);
      } else {
        deleteContextFromLocalStorage(hash);
        window.dispatchEvent(new Event("dx2_contexts_updated"));
      }

      forceRender({});
    }
  };
  const handleClickCreateWithCellLineSelector = () => {
    createNewInCellLineSelector()
      .then(({ lines, contextName }) => {
        if (lines.length === 0) {
          return null;
        }

        return saveContextToLocalStorage({
          name: contextName,
          context_type: "depmap_model",
          expr: {
            in: [
              {
                var: "slice/cell_line_display_name/all/label",
              },
              lines,
            ],
          },
        });
      })
      .then((savedHash) => {
        if (savedHash) {
          window.dispatchEvent(new Event("dx2_contexts_updated"));
          forceRender({});
        }
      });
  };

  return (
    <>
      <Modal
        className={styles.ContextManager}
        show
        backdrop="static"
        onHide={onHide}
        style={{
          visibility:
            showContextModal ||
            isCellLineSelectorVisible ||
            isDownloadContextModalVisible
              ? "hidden"
              : "visible",
        }}
      >
        <Modal.Header closeButton>
          {showHelpText && contextType === "depmap_model" ? (
            <Modal.Title>
              Cell Line Selector has merged with Context Manager
            </Modal.Title>
          ) : (
            <Modal.Title>Context Manager</Modal.Title>
          )}
        </Modal.Header>
        <Modal.Body>
          {showHelpText && contextType === "depmap_model" && <Welcome />}
          <ContextTypeSelect
            value={contextType}
            onChange={(value: string) => setContextType(value)}
          />
          <div className={styles.ContextList}>
            <div
              id="context-list-items"
              ref={contextListRef}
              className={cx(styles.ContextListItems, {
                [styles.showHelpText]: showHelpText,
              })}
            >
              {Object.entries(contexts)
                .reverse()
                .map(([hash, context]) => (
                  <ContextListItem
                    key={hash}
                    contextName={context.name}
                    onClickEdit={() => {
                      handleClickEdit(hash, !!context.isLegacyList);
                    }}
                    onClickDuplicate={() => {
                      handleClickDuplicate(hash, !!context.isLegacyList);
                    }}
                    onClickDelete={() => {
                      handleClickDelete(
                        hash,
                        context.name,
                        !!context.isLegacyList
                      );
                    }}
                    onClickDownload={() => {
                      showDownloadContextModal(
                        context.name,
                        context.context_type,
                        hash
                      );
                    }}
                  />
                ))}
            </div>
            <div className={styles.NewContextItem}>
              <Button
                onClick={() => {
                  openContextEditor(null, { context_type: contextType });
                }}
              >
                Create new +
              </Button>
              {contextType === "depmap_model" && (
                <Button
                  style={{ marginLeft: 10 }}
                  onClick={handleClickCreateWithCellLineSelector}
                >
                  Create new with Cell Line Selector +
                </Button>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="primary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      <ContextBuilderModal
        backdrop={false}
        show={showContextModal}
        context={contextToEdit.current as DataExplorerContext}
        onClickSave={onClickSave.current}
        onHide={() => setShowContextModal(false)}
        isExistingContext
      />
      <CellLineSelectorModal />
      <DownloadContextModal />
    </>
  );
}

export default ContextManagerContent;
