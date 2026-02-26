import React, { useEffect, useState } from "react";
import cx from "classnames";
import { enabledFeatures } from "@depmap/globals";
import { Alignments } from "src/celligner/models/types";
import { useLegendCLickLogic } from "src/celligner/utilities/plot";

interface Props {
  alignments: Alignments;
  onChange: (tumorLegendPointVisibilty: boolean[]) => void;
}

const labels: Record<string, string> = {
  "depmap-model": "DepMap cell line",
  "met500-tumor": "Met500 tumors",
  "novartisPDX-model": "Novartis PDX",
  "pediatricPDX-model": "Pediatric PDX",
  "tcgaplus-tumor": " TCGA+ Tumors",
  "hcmi-model": "HCMI model",
  "hcmi-tumor": "HCMI tumor",
};

const svgs: Record<string, React.ReactElement> = {
  "depmap-model": (
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        transform="translate(10, 10)"
        d="M7.5,0A7.5,7.5 0 1,1 0,-7.5A7.5,7.5 0 0,1 7.5,0Z"
        style={{
          opacity: 1,
          strokeWidth: 1,
          fill: "#ccc",
          fillOpacity: 1,
          stroke: "black",
          strokeOpacity: 1,
        }}
      />
    </svg>
  ),
  "met500-tumor": (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <path
        transform="translate(15, 15)"
        d="M-8.66,3.75H8.66L0,-7.5Z"
        style={{
          opacity: 1,
          fill: "#ccc",
          fillOpacity: 1,
        }}
      />
    </svg>
  ),
  "novartisPDX-model": (
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        transform="translate(10, 10)"
        d="M9.75,0L0,9.75L-9.75,0L0,-9.75Z"
        style={{
          opacity: 1,
          strokeWidth: 1,
          fill: "#ccc",
          fillOpacity: 1,
          stroke: "black",
          strokeOpacity: 1,
        }}
      />
    </svg>
  ),
  "pediatricPDX-model": (
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        transform="translate(10, 10)"
        d="M9.75,0L0,9.75L-9.75,0L0,-9.75Z"
        style={{
          opacity: 1,
          strokeWidth: 1,
          fill: "#ccc",
          fillOpacity: 1,
          stroke: "black",
          strokeOpacity: 1,
        }}
      />
    </svg>
  ),
  "tcgaplus-tumor": (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <path
        transform="translate(15, 15)"
        d="M9,3H3V9H-3V3H-9V-3H-3V-9H3V-3H9Z"
        style={{
          opacity: 1,
          fill: "#ccc",
          fillOpacity: 1,
        }}
      />
    </svg>
  ),
  "hcmi-model": (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 9.172L17.657 3.515L20.485 6.343L14.828 12L20.485 17.657L17.657 20.485L12 14.828L6.343 20.485L3.515 17.657L9.172 12L3.515 6.343L6.343 3.515L12 9.172Z"
        fill="#C4C4C4"
        stroke="black"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  ),
  "hcmi-tumor": (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 9.172L17.657 3.515L20.485 6.343L14.828 12L20.485 17.657L17.657 20.485L12 14.828L6.343 20.485L3.515 17.657L9.172 12L3.515 6.343L6.343 3.515L12 9.172Z"
        fill="#C4C4C4"
      />
    </svg>
  ),
};

function CellLineTumorLegend({ alignments, onChange }: Props) {
  const [hiddenLegendKeys, setHiddenLegendKeys] = useState<
    Set<string | number>
  >(new Set());

  const keys = [
    "depmap-model",
    enabledFeatures.celligner_app_v3 && "met500-tumor",
    enabledFeatures.celligner_app_v3 && "novartisPDX-model",
    enabledFeatures.celligner_app_v3 && "pediatricPDX-model",
    "tcgaplus-tumor",
    "hcmi-tumor",
    "hcmi-model",
  ].filter(Boolean) as string[];

  useEffect(() => {
    const pointVisibility = alignments.type.map(
      (value) => !hiddenLegendKeys.has(value)
    );

    onChange(pointVisibility);
  }, [alignments.type, hiddenLegendKeys, onChange]);

  const { handleClick } = useLegendCLickLogic(keys, setHiddenLegendKeys);

  return (
    <ul className="celligner_graph_plotly_legend">
      {keys.map((key) => (
        <li key={key}>
          <button
            type="button"
            onClick={() => handleClick(key)}
            className={cx("celligner_legend_item", {
              "celligner_legend_item--toggled_off": hiddenLegendKeys.has(key),
            })}
          >
            {svgs[key]}
            <span>{labels[key]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default CellLineTumorLegend;
