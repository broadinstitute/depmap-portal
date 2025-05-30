import React, { useEffect, useState } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { Button, DropdownButton, MenuItem } from "react-bootstrap";
import {
  Tooltip,
  PanIcon,
  ZoomIcon,
  BoxSelectIcon,
  LassoSelectIcon,
} from "@depmap/common-components";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/plot/styles/PlotControls.scss";

type Option = { label: string; value: number; stringId?: string };
type Dragmode = "zoom" | "pan" | "select" | "lasso";
type DownloadImageOptions = Omit<
  Parameters<ExtendedPlotType["downloadImage"]>[0],
  "format"
>;

export enum PlotToolOptions {
  Zoom,
  Pan,
  Select,
  Deselect,
  Annotate,
  Lasso,
  Search,
  Download,
  MakeContext,
  UnselectAnnotatedPoints,
}

interface Props {
  plot: ExtendedPlotType | null;
  searchOptions: Option[] | null;
  onSearch: (selection: Option) => void;
  onDownload: () => void;
  searchPlaceholder: string;
  downloadImageOptions?: DownloadImageOptions;
  enabledTools?: PlotToolOptions[];
  onMakeContext?: () => void;
  onDeselectPoints?: () => void;
  altContainerStyle?: any;
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
  searchOptions,
  onSearch,
  onDownload,
  searchPlaceholder,
  downloadImageOptions = undefined,
  enabledTools = undefined,
  onMakeContext = () => {},
  onDeselectPoints = () => {},
  altContainerStyle = undefined,
}: Props) {
  const [dragmode, setDragmode] = useState<Dragmode>("zoom");

  useEffect(() => {
    plot?.setDragmode(dragmode);
  }, [plot, dragmode]);

  const allDefaultEnabled = !enabledTools;
  const zoomEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Zoom);
  const panEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Pan);
  const selectEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Select);
  const annotateEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Annotate);

  // Used in Celligner where annotation selection is controlled by the table
  // row clicks instead of clicking directly on points. Annotation unselect still
  // needs to be controlled by button.
  const onlyUnselectAnnotateEnabled =
    enabledTools?.includes(PlotToolOptions.UnselectAnnotatedPoints) &&
    !enabledTools?.includes(PlotToolOptions.Annotate);

  const lassoEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Lasso);
  const searchEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Search);
  const downloadEnabled =
    allDefaultEnabled || enabledTools?.includes(PlotToolOptions.Download);
  const deselectEnabled = enabledTools?.includes(PlotToolOptions.Deselect);
  const makeContextEnabled = enabledTools?.includes(
    PlotToolOptions.MakeContext
  ); // A newer, more experimental tool, so only turn on if explicitly included in the enabledTools list.

  return (
    <div className={styles.PlotControls}>
      <div style={altContainerStyle} className={styles.container}>
        <div className={styles.buttonGroup}>
          {zoomEnabled && (
            <DragmodeButton
              dragmode="zoom"
              disabled={!plot}
              active={dragmode === "zoom"}
              onClick={() => setDragmode("zoom")}
            />
          )}
          {panEnabled && (
            <DragmodeButton
              dragmode="pan"
              disabled={!plot}
              active={dragmode === "pan"}
              onClick={() => setDragmode("pan")}
            />
          )}
          {selectEnabled && (
            <DragmodeButton
              dragmode="select"
              disabled={!plot}
              active={dragmode === "select"}
              onClick={() => setDragmode("select")}
            />
          )}
          {lassoEnabled && (
            <DragmodeButton
              dragmode="lasso"
              disabled={!plot}
              active={dragmode === "lasso"}
              onClick={() => setDragmode("lasso")}
            />
          )}
          {deselectEnabled && (
            <Tooltip
              id="deselect-points-tooltip"
              content="Undo lasso/box point selection"
              placement="top"
            >
              <Button disabled={!plot} onClick={() => onDeselectPoints()}>
                Deselect
              </Button>
            </Tooltip>
          )}
        </div>
        {makeContextEnabled && (
          <div className={styles.buttonGroup}>
            <Tooltip
              id="make-context-from-points-tooltip"
              content="Make a context from the current selection"
              placement="top"
            >
              <Button disabled={!plot} onClick={() => onMakeContext()}>
                Make Context
              </Button>
            </Tooltip>
          </div>
        )}
        {zoomEnabled && (
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
        )}
        {(annotateEnabled || onlyUnselectAnnotateEnabled) && (
          <div className={styles.buttonGroup}>
            {!onlyUnselectAnnotateEnabled && (
              <Tooltip
                id="label-points-tooltip"
                content="Label selected points"
                placement="top"
              >
                <Button
                  disabled={!plot}
                  onClick={() => plot!.annotateSelected()}
                >
                  <span className="glyphicon glyphicon-tags" />
                </Button>
              </Tooltip>
            )}
            {(annotateEnabled || onlyUnselectAnnotateEnabled) && (
              <>
                <Tooltip
                  id="unlabel-points-tooltip"
                  content="Unlabel all points"
                  placement="top"
                >
                  <Button
                    disabled={!plot}
                    onClick={() => plot!.removeAnnotations()}
                  >
                    <span className="glyphicon glyphicon-ban-circle" />
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        )}
        {searchEnabled && (
          <div className={styles.search}>
            <Typeahead
              id="plot-controls-search"
              onChange={(options: Option[]) => {
                if (options[0]) {
                  onSearch(options[0]);
                }
              }}
              disabled={!searchOptions}
              options={searchOptions || []}
              selected={[]}
              minLength={1}
              placeholder={searchPlaceholder}
              highlightOnlyResult
            />
          </div>
        )}
        {downloadEnabled && (
          <div className={styles.buttonGroup}>
            <Tooltip
              id="download-data-tooltip"
              content="Download filtered data"
              placement="top"
            >
              <DropdownButton
                id="plot-controls-download"
                title={<span className="glyphicon glyphicon-download-alt" />}
                bsSize="small"
                pullRight
              >
                {downloadImageOptions && (
                  <MenuItem
                    onClick={() =>
                      plot!.downloadImage({
                        ...downloadImageOptions,
                        format: "png",
                      })
                    }
                  >
                    Image (.png)
                  </MenuItem>
                )}
                {downloadImageOptions && (
                  <MenuItem
                    onClick={() =>
                      plot!.downloadImage({
                        ...downloadImageOptions,
                        format: "svg",
                      })
                    }
                  >
                    Image (.svg)
                  </MenuItem>
                )}
                <MenuItem onClick={onDownload}>Filtered data (.csv)</MenuItem>
              </DropdownButton>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlotControls;
