import React, { useEffect, useState } from "react";
import { Base64 } from "js-base64";
import { Typeahead } from "react-bootstrap-typeahead";
import { Button, DropdownButton, MenuItem } from "react-bootstrap";
import {
  BoxSelectIcon,
  LassoSelectIcon,
  PanIcon,
  Tooltip,
  ZoomIcon,
} from "@depmap/common-components";
import type { DataExplorerPlotType } from "@depmap/types";
import { useDataExplorerSettings } from "../../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../../ExtendedPlotType";
import ExportImageModal, { PreviewPlotSupport } from "../ExportImageModal";
import SettingsButton from "./SettingsButton";
import styles from "../../../styles/PlotControls.scss";

type Option = { label: string; value: string };
type Dragmode = "zoom" | "pan" | "select" | "lasso";
type DownloadImageOptions = Omit<
  Parameters<ExtendedPlotType["downloadImage"]>[0],
  "format"
>;

interface Props {
  plot: ExtendedPlotType | null;
  onDownload: () => void;
  onClickUnselectAll: () => void;
  onSearch?: (selection: Option) => void;
  searchOptions?: Option[];
  searchPlaceholder?: string;
  hideSelectionTools?: boolean;
  downloadImageOptions?: DownloadImageOptions;
  // Lets the export modal draw a second, non-interactive copy of this plot at
  // styles of the caller's choosing. Supplied by the wrappers that can build
  // one; when it's absent the modal still previews and resizes the image, it
  // just can't offer the style controls.
  previewPlot?: PreviewPlotSupport;
  // Namespaces the export modal's remembered settings — see
  // rememberedConfig's own comment on the shared/per-type split.
  plotType: DataExplorerPlotType;
}

const toIcon = (dragmode: Dragmode) =>
  ({
    zoom: ZoomIcon,
    pan: PanIcon,
    select: BoxSelectIcon,
    lasso: LassoSelectIcon,
  }[dragmode]);

const getTooltipText = (dragmode: Dragmode) =>
  ({
    zoom: "Zoom",
    pan: "Pan",
    select: "Box Select",
    lasso: "Lasso Select",
  }[dragmode]);

const DragmodeButton = ({
  dragmode,
  active,
  disabled,
  onClick,
}: {
  dragmode: Dragmode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) => {
  const IconButton = toIcon(dragmode);

  return (
    <Tooltip
      id={`${dragmode}-tooltip`}
      content={getTooltipText(dragmode)}
      placement="top"
    >
      <IconButton
        bsSize="xs"
        active={active}
        disabled={disabled}
        onClick={onClick}
      />
    </Tooltip>
  );
};

function PlotControls({
  plot,
  onDownload,
  onClickUnselectAll,
  searchOptions = undefined,
  downloadImageOptions = undefined,
  onSearch = () => {},
  searchPlaceholder = "Search…",
  hideSelectionTools = false,
  previewPlot = undefined,
  plotType,
}: Props) {
  const [dragmode, setDragmode] = useState<Dragmode>("zoom");
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    plot?.setDragmode(dragmode);
  }, [plot, dragmode]);

  const { plotStyles } = useDataExplorerSettings();

  return (
    <div className={styles.PlotControls}>
      <div className={styles.container}>
        <div className={styles.buttonGroup}>
          <DragmodeButton
            dragmode="zoom"
            disabled={!plot}
            active={dragmode === "zoom"}
            onClick={() => setDragmode("zoom")}
          />
          <DragmodeButton
            dragmode="pan"
            disabled={!plot}
            active={dragmode === "pan"}
            onClick={() => setDragmode("pan")}
          />
          {!hideSelectionTools && (
            <DragmodeButton
              dragmode="select"
              disabled={!plot}
              active={dragmode === "select"}
              onClick={() => setDragmode("select")}
            />
          )}
          {!hideSelectionTools && (
            <DragmodeButton
              dragmode="lasso"
              disabled={!plot}
              active={dragmode === "lasso"}
              onClick={() => setDragmode("lasso")}
            />
          )}
        </div>
        <div className={styles.buttonGroup}>
          <Tooltip
            id="unselect-all-tooltip"
            content="Unselect all"
            placement="top"
          >
            <Button disabled={!plot} onClick={onClickUnselectAll}>
              <span className="glyphicon glyphicon-ban-circle" />
            </Button>
          </Tooltip>
        </div>
        <div className={styles.buttonGroup}>
          <Button disabled={!plot} onClick={plot?.zoomIn}>
            <span className="glyphicon glyphicon-plus" />
          </Button>
          <Button disabled={!plot} onClick={plot?.zoomOut}>
            <span className="glyphicon glyphicon-minus" />
          </Button>
          <Button disabled={!plot} onClick={plot?.resetZoom}>
            reset
          </Button>
        </div>
        <div className={styles.search}>
          {searchOptions && onSearch && (
            <Typeahead
              id="plot-controls-search"
              onChange={(options: Option[]) => {
                if (options[0]) {
                  onSearch(options[0]);
                }
              }}
              disabled={!searchOptions || !plot}
              options={searchOptions}
              selected={[]}
              minLength={1}
              placeholder={searchPlaceholder}
              highlightOnlyResult
            />
          )}
        </div>
        <SettingsButton />
        <div className={styles.buttonGroup}>
          <Tooltip
            id="download-data-tooltip"
            content="Export as…"
            placement="top"
          >
            <DropdownButton
              id="plot-controls-download"
              title={<span className="glyphicon glyphicon-download-alt" />}
              bsSize="small"
              disabled={!plot}
              pullRight
            >
              {downloadImageOptions && (
                <MenuItem onClick={() => setShowExportModal(true)}>
                  Export image…
                </MenuItem>
              )}
              <MenuItem onClick={onDownload}>Export CSV…</MenuItem>
              <MenuItem
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  const pParam = params.get("p");
                  const stylesJson = JSON.stringify(plotStyles);
                  const encodedStyles = Base64.encode(stylesJson, true);

                  const baseUrl =
                    process.env.NODE_ENV === "development"
                      ? "http://localhost:8002/embed"
                      : "../breadbox/embed";

                  window.open(
                    `${baseUrl}/plot?p=${pParam}&styles=${encodedStyles}`
                  );
                }}
              >
                Standalone plot
              </MenuItem>
            </DropdownButton>
          </Tooltip>
        </div>
      </div>
      {showExportModal && plot && downloadImageOptions && (
        <ExportImageModal
          plot={plot}
          filename={downloadImageOptions.filename ?? "plot"}
          previewPlot={previewPlot}
          plotType={plotType}
          onHide={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

export default PlotControls;
