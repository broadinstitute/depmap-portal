import React from "react";
import { InfoTip } from "@depmap/common-components";
import { toStaticUrl } from "@depmap/globals";
import { OncogenicAlteration } from "@depmap/types";
import { altKey } from "../hooks/useAcquiredAlterations";
import styles from "../styles/CellLinePage.scss";

interface OncogenicAlterationsTileProps {
  oncogenicAlterations: Array<OncogenicAlteration>;
  // Keys (gene name + alteration) of alterations acquired during derivation
  // of the current model. Empty or omitted for non-derivative models.
  acquiredAlterations?: Set<string>;
  oncokbDatasetVersion: string;
}

const OncogenicAlterationsTile = ({
  oncogenicAlterations,
  acquiredAlterations = undefined,
  oncokbDatasetVersion,
}: OncogenicAlterationsTileProps) => {
  const hasSomeAcquiredAlterations =
    acquiredAlterations && acquiredAlterations.size > 0;

  const tableRows = oncogenicAlterations.map((alteration) => {
    const key = altKey(alteration);
    const isAcquired = acquiredAlterations?.has(key) ?? false;

    return (
      <tr key={key}>
        <td>
          <a
            href={`https://www.oncokb.org/gene/${alteration.gene.name}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {alteration.gene.name}
          </a>
        </td>
        <td>
          <a
            href={`https://www.oncokb.org/gene/${alteration.gene.name}/${alteration.alteration}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {alteration.alteration}
          </a>
        </td>
        <td className="center">{alteration.oncogenic}</td>
        <td className="center">{alteration.function_change}</td>
        {isAcquired && (
          <td className={styles.acquiredAlterationCheckmark}>
            <span className="glyphicon glyphicon-ok" />
          </td>
        )}
      </tr>
    );
  });

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
                {hasSomeAcquiredAlterations && (
                  <th className="center">
                    <div style={{ display: "flex" }}>
                      Acquired?
                      <InfoTip
                        placement="top"
                        id="acquired-alterations"
                        title="Acquired alterations"
                        content={
                          <div>
                            Alterations present in this resistant derivative but
                            not in its parental model.
                          </div>
                        }
                      />
                    </div>
                  </th>
                )}
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
