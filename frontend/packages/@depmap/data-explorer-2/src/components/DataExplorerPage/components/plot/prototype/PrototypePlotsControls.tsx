import React, { useEffect, useState } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { Button, DropdownButton, MenuItem } from "react-bootstrap";
import {
  BoxSelectIcon,
  LassoSelectIcon,
  PanIcon,
  Tooltip,
  ZoomIcon,
} from "@depmap/common-components";
import type ExtendedPlotType from "../../../ExtendedPlotType";
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
}: Props) {
  const [dragmode, setDragmode] = useState<Dragmode>("zoom");

  useEffect(() => {
    plot?.setDragmode(dragmode);
  }, [plot, dragmode]);

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
            content="Download as…"
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
              <MenuItem onClick={onDownload}>Data (.csv)</MenuItem>
            </DropdownButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default PlotControls;
