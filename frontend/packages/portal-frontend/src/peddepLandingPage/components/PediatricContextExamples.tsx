import React from "react";
import { toStaticUrl } from "@depmap/globals";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";

export default function PediatricContextExamples() {
  return (
    <div>
      <div className={styles.pediatricContextSection}>
        <div className={styles.cardContainer}>
          <div>
            <img
              className={styles.cardImg}
              src={toStaticUrl("img/peddep_landing_page/peddep_dep.png")}
              alt="Discover dependencies"
              style={{
                borderRadius: "3px",
                border: "1px solid black",
                width: "100%",
              }}
            />
          </div>
          <div className="cardText">
            <h5>
              <a href="#"></a>Explore DCAF5 dependency in SMARCB1 deficient
              pediatric Rhabdoid cancers
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric
              Rhabdoid cancer using PedDep Data. Read more about this dependency
              in <a href="">Radko-Juettner, S et al</a>
            </h6>
          </div>
        </div>
        <div className={styles.cardContainer}>
          <div>
            <img
              className={styles.cardImg}
              src={toStaticUrl(
                "img/peddep_landing_page/peddep_lineage_context.png"
              )}
              alt="Compare biomarkers"
              style={{
                borderRadius: "3px",
                border: "1px solid black",
                width: "100%",
              }}
            />
          </div>
          <div className="cardText">
            <h5>
              <a href="#"></a>Look at the lineage context for TRIM8 in pediatric
              Ewings Sarcomas
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric Ewing
              Sarcoma using PedDep Data. Read more about this dependency in{" "}
              <a href="">Seong, BKA et al</a>
            </h6>
          </div>
        </div>
        <div className={styles.cardContainer}>
          <div>
            <img
              className={styles.cardImg}
              src={toStaticUrl("img/peddep_landing_page/peddep_selective.png")}
              alt="Browse cancer models"
              style={{
                borderRadius: "3px",
                border: "1px solid black",
                width: "100%",
              }}
            />
          </div>
          <div className="cardText">
            <h5>
              <a href="#"></a>NXT1 as a selective dependency in MYCN-amplified
              Neuroblastoma
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric
              neuroblastoma using PedDep Data. Read more about this dependency
              in <a href="">Malone, CF et al</a>
            </h6>
          </div>
        </div>
        <div className={styles.cardContainer}>
          <div>
            <img
              className={styles.cardImg}
              src={toStaticUrl("img/peddep_landing_page/pediatric_context.png")}
              alt="Discover targets"
              style={{
                borderRadius: "3px",
                border: "1px solid black",
                width: "100%",
              }}
            />
          </div>
          <div className="cardText">
            <h5>
              <a href="#"></a>Save a pediatric context and discover how cell
              lines compare to tumors
            </h5>
            <h6>Create and explore pediatric lineages using Celligner</h6>
          </div>
        </div>
      </div>
    </div>
  );
}
