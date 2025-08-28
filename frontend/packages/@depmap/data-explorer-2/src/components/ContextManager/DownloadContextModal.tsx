import React, { useEffect, useRef, useState } from "react";
import { Button, Modal, Radio } from "react-bootstrap";
import { deprecatedDataExplorerAPI } from "../../services/deprecatedDataExplorerAPI";
import ContextNameForm from "../ContextBuilder/ContextNameForm";
import { fetchContext } from "../../utils/context-storage";
import { getDimensionTypeLabel, pluralize } from "../../utils/misc";
import { isV2Context } from "../../utils/context";
import styles from "../../styles/ContextManager.scss";

interface Props {
  contextName: string;
  context_type: string;
  contextHash: string;
  onHide: () => void;
}

function DownloadContextModal({
  contextName,
  context_type,
  contextHash,
  onHide,
}: Props) {
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const [filename, setFilename] = useState(contextName);
  const [format, setFormat] = useState<"list" | "csv">("list");
  const [include, setInclude] = useState<"label" | "display_name" | "both">(
    context_type === "depmap_model" ? "display_name" : "label"
  );

  // Pre-fetch the context so it downloads faster (these requests are cached).
  useEffect(() => {
    fetchContext(contextHash).then((context) => {
      if (isV2Context(context)) {
        throw new Error("V2 contexts not supported!");
      }

      return deprecatedDataExplorerAPI.evaluateLegacyContext(context);
    });
  }, [contextHash]);

  const handleClickDownload = () => {
    if (!filename) {
      setShouldShowValidation(true);
      return;
    }

    fetchContext(contextHash)
      .then((context) => {
        if (isV2Context(context)) {
          throw new Error("V2 contexts not supported!");
        }

        return deprecatedDataExplorerAPI.evaluateLegacyContext(context);
      })
      .then(async (contextLabels) => {
        let labels = contextLabels;

        if (include === "display_name" || include === "both") {
          // For now, we assume that the downloads are models if we're trying
          // to use their display name (other types don't currently support a
          // display name).
          if (context_type !== "depmap_model") {
            throw new Error("only supports depmap_model");
          }

          const sliceId = "slice/cell_line_display_name/all/label";
          labels = await deprecatedDataExplorerAPI
            .fetchMetadataColumn(sliceId)
            .then((column) => {
              return labels.map(
                (depmap_id) => column.indexed_values[depmap_id]
              );
            });
        }

        const link = document.createElement("a");
        let text = labels.join(format === "list" ? "\r\n" : ",");
        let download = filename;

        // Assume we're downloading models in this case and include a header.
        if (format === "csv" && include === "both") {
          text = [
            "DepMap ID,cell line name",
            ...labels.map((label, i) => `${contextLabels[i]},${label}`),
          ].join("\r\n");

          download = `${filename}.csv`;
        }

        link.href = `data:text/plain,${encodeURIComponent(text)}`;
        link.download = download;
        link.click();
        onHide();
      });
  };

  return (
    <Modal show backdrop={false} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>
          Download {pluralize(getDimensionTypeLabel(context_type))} from “
          {contextName}”
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ContextNameForm
          label="Filename"
          value={filename}
          onChange={setFilename}
          onSubmit={() => {}}
          shouldShowValidation={shouldShowValidation}
        />
        <div>
          <label
            className={styles.downloadModalLabel}
            htmlFor="download-context-format"
          >
            Format
          </label>
          <Radio
            inline
            name="download-context-format"
            checked={format === "list"}
            onChange={() => {
              setFormat("list");

              if (include === "both") {
                setInclude("label");
              }
            }}
          >
            List
          </Radio>
          <Radio
            inline
            name="download-context-format"
            checked={format === "csv"}
            onChange={() => setFormat("csv")}
          >
            CSV
          </Radio>
        </div>
        {context_type === "depmap_model" && (
          <div>
            <label
              className={styles.downloadModalLabel}
              htmlFor="download-context-xxx"
            >
              Include
            </label>
            <Radio
              inline
              name="download-context-include"
              checked={include === "display_name"}
              onChange={() => setInclude("display_name")}
            >
              Cell line names
            </Radio>
            <Radio
              inline
              name="download-context-include"
              checked={include === "label"}
              onChange={() => setInclude("label")}
            >
              DepMap IDs
            </Radio>
            <Radio
              inline
              name="download-context-include"
              checked={include === "both"}
              onChange={() => {
                setFormat("csv");
                setInclude("both");
              }}
            >
              Both (CSV only)
            </Radio>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>Cancel</Button>
        <Button bsStyle="primary" onClick={handleClickDownload}>
          Download
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function useDownloadContextModal() {
  const [show, setShow] = useState(false);
  const contextToDownload = useRef<{
    contextName: string;
    context_type: string;
    contextHash: string;
  } | null>(null);

  return {
    isDownloadContextModalVisible: show,

    showDownloadContextModal: (
      contextName: string,
      context_type: string,
      contextHash: string
    ) => {
      contextToDownload.current = { contextName, context_type, contextHash };
      setShow(true);
    },

    DownloadContextModal: () => {
      return show ? (
        <DownloadContextModal
          contextName={contextToDownload.current!.contextName}
          context_type={contextToDownload.current!.context_type}
          contextHash={contextToDownload.current!.contextHash}
          onHide={() => setShow(false)}
        />
      ) : null;
    },
  };
}
