/* eslint-disable */
import React, { useState } from "react";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import * as utils from "../utilities/downloadIconUtils";
import { PlotHTMLElement } from "../models/plotlyPlot";
import { DownloadIconWidgetProps } from "../models/plotlyWrapper";
import * as ReactCSV from "react-csv";
import { assert } from "@depmap/utils";

type PlotlyType = typeof import("plotly.js");

type DownloadIconProps = DownloadIconWidgetProps & {
  Plotly: PlotlyType;
  plotlyRef: React.RefObject<HTMLDivElement & PlotHTMLElement>;
  idPrefixForUniqueness: string;
};

// This menu content is rendered conditionally below because the
// <ReactCSV.CSVLink /> element is expensive to generate. We only want to
// incur that cost if/when the user is interested in downloading the data.
// As a further optimization, `downloadDataArray` can be provided as a function
// so that any formatting is done lazily.
const MenuContent = ({
  downloadImagePng,
  downloadImageSvg,
  downloadDataUrl,
  downloadDataArray,
  downloadFilename,
}: {
  downloadImagePng: () => void;
  downloadImageSvg: () => void;
  downloadDataUrl?: string;
  downloadDataArray?: any[] | (() => any[]);
  downloadFilename: string;
}) => {
  const data =
    typeof downloadDataArray === "function"
      ? downloadDataArray()
      : downloadDataArray;

  return (
    <>
      <MenuItem onClick={downloadImagePng}>Image (.png)</MenuItem>
      <MenuItem onClick={downloadImageSvg}>Image (.svg)</MenuItem>
      {downloadDataUrl && (
        <MenuItem href={downloadDataUrl}>Data (.csv)</MenuItem>
      )}
      {data && (
        // mimics MenuItem, out of laziness
        <li role="presentation">
          <ReactCSV.CSVLink
            role="menuitem"
            data={data}
            filename={`${downloadFilename}.csv`}
          >
            Data (.csv)
          </ReactCSV.CSVLink>
        </li>
      )}
    </>
  );
};

export const DownloadIcon = (props: DownloadIconProps) => {
  const [open, setOpen] = useState(false);

  assert(
    !(props.downloadDataUrl && props.downloadDataArray),
    "One or the other"
  );

  const downloadImagePng = () =>
    utils.downloadImage(
      props.Plotly,
      props.plotlyRef.current as any,
      props.downloadFilename,
      "png"
    );
  const downloadImageSvg = () =>
    utils.downloadImage(
      props.Plotly,
      props.plotlyRef.current as any,
      props.downloadFilename,
      "svg"
    );

  return (
    <Tooltip
      id={`${props.idPrefixForUniqueness}-download-plot-icon-tooltip`}
      content="Download"
      placement="top"
    >
      <DropdownButton
        id={`${props.idPrefixForUniqueness}-download-plot-icon`}
        title={<span className="glyphicon glyphicon-download-alt" />}
        bsSize="small"
        onToggle={setOpen}
      >
        {open && (
          <MenuContent
            downloadImagePng={downloadImagePng}
            downloadImageSvg={downloadImageSvg}
            downloadDataUrl={props.downloadDataUrl}
            downloadDataArray={props.downloadDataArray}
            downloadFilename={props.downloadFilename}
          />
        )}
      </DropdownButton>
    </Tooltip>
  );
};
