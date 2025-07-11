import React from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";

interface StructureAndDetailTileProps {
  compoundName: string;
  compoundId: string;
}

export const StructureAndDetailTile: React.FC<StructureAndDetailTileProps> = ({
  compoundName,
  compoundId,
}) => {
  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="structure and detail info tip"
      className="icon"
    />
  );

  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Structure and Details{" "}
          {true && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"This is a tooltip"}</p>}
              popoverId={`struc-detail-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        <div className="card_padding">
          {compoundName} {compoundId}
        </div>
        <div className="card_padding stacked-boxplot-graphs-padding">
          <div id="enrichment-tile"></div>
          <p className="stacked-boxplot-download-container">
            View more contexts in the <a href={"/"}>Context Explorer</a>
          </p>
        </div>
      </div>
    </article>
  );
};
