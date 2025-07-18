import React from "react";
import { toStaticUrl } from "@depmap/globals";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";

export default function PediatricContextExamples() {
  return (
    <div>
      <div className={styles.cardContainer}>
        <div className={styles.cardImg}>
          <img
            src={toStaticUrl("img/peddep_landing_page/peddep_dep.png")}
            alt="Discover dependencies"
          />
          <div>
            <h5>
              <a href="https://depmap.org/portal/data_explorer_2/?xDataset=Chronos_Combined&yDataset=Chronos_Combined&xContext=%7B%22name%22%3A%22SMARCB1%22%2C%22context_type%22%3A%22depmap_model%22%2C%22expr%22%3A%7B%22%3D%3D%22%3A%5B%7B%22var%22%3A%22slice%2Fmutations_prioritized%2FSMARCB1%2Flabel%22%7D%2C%22Damaging%22%5D%7D%7D&yContext=%7B%22name%22%3A%22Not%20SMARCB1%22%2C%22context_type%22%3A%22depmap_model%22%2C%22expr%22%3A%7B%22!%22%3A%7B%22%3D%3D%22%3A%5B%7B%22var%22%3A%22slice%2Fmutations_prioritized%2FSMARCB1%2Flabel%22%7D%2C%22Damaging%22%5D%7D%7D%7D&color_property=slice%2Fgene_selectivity%2Fall%2Flabel">
                Explore DCAF5 dependency in SMARCB1 deficient pediatric Rhabdoid
                cancers
              </a>
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric
              Rhabdoid cancer using PedDep Data. Read more about this dependency
              in{" "}
              <a href="https://pubmed.ncbi.nlm.nih.gov/38538798/">
                Radko-Juettner, S et al
              </a>
            </h6>
          </div>
        </div>
        <div className={styles.cardImg}>
          <img
            src={toStaticUrl(
              "img/peddep_landing_page/peddep_lineage_context.png"
            )}
            alt="Compare biomarkers"
          />
          <div>
            <h5>
              <a href="https://depmap.org/portal/data_explorer_2/?xDataset=Chronos_Combined&xFeature=TRIM8&yDataset=expression&yFeature=TRIM8&color1=%7B%22context_type%22%3A%22depmap_model%22%2C%22expr%22%3A%7B%22%3D%3D%22%3A%5B%7B%22var%22%3A%22slice%2Flineage%2F3%2Flabel%22%7D%2C%22Ewing%20Sarcoma%22%5D%7D%2C%22name%22%3A%22Ewing%20Sarcoma%22%7D">
                Look at the lineage context for TRIM8 in pediatric Ewings
                Sarcomas
              </a>
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric Ewing
              Sarcoma using PedDep Data. Read more about this dependency in{" "}
              <a href="https://pubmed.ncbi.nlm.nih.gov/34329586/">
                Seong, BKA et al
              </a>
            </h6>
          </div>
        </div>
        <div className={styles.cardImg}>
          <img
            src={toStaticUrl("img/peddep_landing_page/peddep_selective.png")}
            alt="Browse cancer models"
          />
          <div>
            <h5>
              <a href="https://depmap.org/portal/data_explorer_2/?xDataset=expression&xFeature=NXT1&yDataset=expression&yFeature=NXT2&color1=%7B%22context_type%22%3A%22depmap_model%22%2C%22expr%22%3A%7B%22and%22%3A%5B%7B%22%3D%3D%22%3A%5B%7B%22var%22%3A%22slice%2Flineage%2F2%2Flabel%22%7D%2C%22Neuroblastoma%22%5D%7D%2C%7B%22%3E%22%3A%5B%7B%22var%22%3A%22slice%2Fcopy_number_relative%2FMYCN%2Flabel%22%7D%2C2%5D%7D%5D%7D%2C%22name%22%3A%22Neuroblastoma%22%7D">
                NXT1 as a selective dependency in MYCN-amplified Neuroblastoma
              </a>
            </h5>
            <h6>
              View a preloaded example in Data Explorer based on pediatric
              neuroblastoma using PedDep Data. Read more about this dependency
              in{" "}
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8419012/">
                Malone, CF et al
              </a>
            </h6>
          </div>
        </div>
        <div className={styles.cardImg}>
          <img
            src={toStaticUrl("img/peddep_landing_page/pediatric_context.png")}
            alt="Discover targets"
          />
          <div>
            <h5>
              <a href="https://depmap.org/portal/celligner/">
                Save a pediatric context and discover how cell lines compare to
                tumors
              </a>
            </h5>
            <h6>Create and explore pediatric lineages using Celligner</h6>
          </div>
        </div>
      </div>
    </div>
  );
}
