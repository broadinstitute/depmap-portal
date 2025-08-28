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
                DCAF5 dependency predicted by SMARCB1 deficiency in pediatric
                Rhabdoid cancers
              </a>
            </h5>
            <h6>
              Read more about this dependency in{" "}
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
              <a href="https://depmap.org/portal/data_explorer_2/?p=eJylUU1rwzAM_SvD50Iou4xAT2WHHQpjy20Mo8RqJvBHsLU2IfS_T86WpCu7zYc4eu_l6UkZFXmDveahQ1Uqg52DTrtg0KqN6mzglfKJeNBbI4Qhl8vgkypH1eeHAYaErMmIeP8Rgw9J74OryWP-BHpKs1eEs06WGhR8umeiRZ8xaNuILbA0EPBIMbGgTfCMPedmHlyWVy9Ph4eVuXHBvotZvNup8m1UJ5BKoec8hYVaJrxsfizeL3Kyjw1R14Po5gholqRHsoxxmngSbr_ffrW-WeCfESa_wspeoMXivliyPJ7Jt3evEJvgQDJt5jknIi2MECdKVFv8V4JrpXbIkH9h8YyGgCM1h4xXYroGrOInXufq0IiJkt19AcuqykA">
                A lineage context for TRIM8 in pediatric Ewings Sarcomas
              </a>
            </h5>
            <h6>
              Read more about this context in{" "}
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
              <a href="https://depmap.org/portal/data_explorer_2/?p=eJy1kcFqwzAMht_F50JJDzsEehhhx46ulK5jDKPGSqLhOMZ222Ql7z65XcI2ellhF2NJv-Tvt07C6ibI0FkUqfA5hIBOTAQZhe2QVmhrsLJuFGquKarReGqMF-lJtPGAlvygdnCUXlOOLIWydFhCYDFXCnI-cDZvTMA2xMav69BbooltBuoYPW7XCUfYWhe187lIX0_iABwJNIFCJzXsmKmfXLRvPd8UBPAYJKko4170EZYHnal-PMXy7l_5Z3_gn93A30ca3Ti5Yx8jLqrRQUGaN3re1IE87TRewf614KvA54HT70pZY4BIO12iIgiO8kXMr3nodDS2dntkY-OnWFQ8RAzgSXyoAl9xqVquSG6ypNi_H9uVfnrpPoqyu7NUZlTdL5KMtpBJv3nePMzjL1-sirQA7bHv-0-8hvdD">
                NXT1 as a selective dependency in MYCN-amplified Neuroblastoma
              </a>
            </h5>
            <h6>
              Read more about this dependency in{" "}
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8419012/">
                Malone, CF et al
              </a>
            </h6>
          </div>
        </div>
        <div className={styles.cardImg}>
          <img
            src={toStaticUrl("img/peddep_landing_page/peddep_context.png")}
            alt="Discover targets"
          />
          <div>
            <h5>
              <a href="https://depmap.org/portal/context_explorer/?tab=overview&context=BALL">
                Explore pediatric lineage contexts and subtypes of interest
              </a>
            </h5>
            <h6>Explorer pediatric lineage contexts using Context Explorer</h6>
          </div>
        </div>
      </div>
    </div>
  );
}
