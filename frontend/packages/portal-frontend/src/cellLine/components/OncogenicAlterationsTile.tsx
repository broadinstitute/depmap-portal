import React from "react";
import { OncogenicAlteration } from "src/cellLine/models/types";
import { toStaticUrl } from "src/common/utilities/context";

interface OncogenicAlterationsTileProps {
  oncogenicAlterations: Array<OncogenicAlteration>;
  oncokbDatasetVersion: string;
}

const OncogenicAlterationsTile = ({
  oncogenicAlterations,
  oncokbDatasetVersion,
}: OncogenicAlterationsTileProps) => {
  const tableRows = oncogenicAlterations.map((alteration) => (
    <tr key={alteration.alteration}>
      <td>
        <a href={`https://www.oncokb.org/gene/${alteration.gene.name}`}>
          {alteration.gene.name}
        </a>
      </td>
      <td>
        <a
          href={`https://www.oncokb.org/gene/${alteration.gene.name}/${alteration.alteration}`}
        >
          {alteration.alteration}
        </a>
      </td>
      <td className="center">{alteration.oncogenic}</td>
      <td className="center">{alteration.function_change}</td>
    </tr>
  ));

  return (
    <article className="card_wrapper oncogenic_alterations_tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Oncogenic Alterations</h2>
        <div className="card_padding">
          <table className="table">
            <thead>
              <tr>
                <th>Gene</th>
                <th>Alteration</th>
                <th className="center">Oncogenic</th>
                <th className="center">Function</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </table>
          <a href="https://www.oncokb.org/" target="blank">
            <img
              src={toStaticUrl("img/mutations/oncokb_logo.png")}
              alt=""
              className="oncokb_logo"
            />
          </a>
          <span>
            <sub style={{ margin: "5px" }}>{oncokbDatasetVersion}</sub>
          </span>
        </div>
      </div>
    </article>
  );
};

export default OncogenicAlterationsTile;
