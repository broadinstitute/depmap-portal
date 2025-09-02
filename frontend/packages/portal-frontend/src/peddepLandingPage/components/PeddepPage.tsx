import * as React from "react";
import { Button } from "react-bootstrap";
import { toStaticUrl } from "@depmap/globals";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";
import SubGroupsPlot from "./SubgroupsPlot";
import PediatricContextExamples from "./PediatricContextExamples";

export default function PeddepPage() {
  const imagePath = toStaticUrl("img/peddep_landing_page/peddep_wave.png");

  const umapImage = (
    <img
      style={{ float: "right" }}
      src={toStaticUrl("img/peddep_landing_page/umap.png")}
      alt="Diagram of UMAP"
    />
  );

  return (
    <div className={styles.PeddepPage}>
      <div
        className={`${styles.PeddepPageContainer} ${styles.highlightBackground}`}
        style={{
          backgroundImage: `url(${imagePath})`,
          backgroundSize: "contain",
          backgroundColor: "rgba(243, 242, 253, 0.8)",
        }}
      >
        <div className={styles.highlight}>
          <div className={styles.highlightText}>
            <h1 className={styles.title}>
              The Pediatric Cancer Dependencies Accelerator
            </h1>
            <h3>
              St. Jude Children&apos;s Research Hospital, The Broad Institute,
              and Dana-Farber Cancer Institute have launched a large-scale
              collaboration to advance understanding of the biological basis of
              pediatric cancers, identify new vulnerabilities of these diseases
              and accelerate therapies globally.
            </h3>
            <Button
              className={styles.peddepBtn}
              href="https://peddep.org/"
              target="_blank"
            >
              Learn more at PedDep.org
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.PeddepPageContainer}>
        <div style={{ display: "grid" }}>
          <h2>Our Goals and Focus</h2>
          <h4>
            The PedDep Accelerator is spearheading a comprehensive initiative to
            advance our understanding of the biological basis of pediatric
            cancers through two complementary strategies: scaling proven
            interventions while simultaneously investing in exploratory science
            with transformative potential.
          </h4>
          <h4>
            By bringing in new and important pediatric models, as well as
            generating new models, the PedDep Accelerator has made progress in
            expanding the representation of pediatric cancer models for the
            research community.
          </h4>
          <div className={styles.plotContainer}>
            <SubGroupsPlot />
          </div>
        </div>
      </div>
      <div
        className={styles.PeddepPageContainer}
        style={{ backgroundColor: "rgba(243, 242, 253, 0.8)" }}
      >
        <div style={{ display: "grid" }}>
          <h2>Navigate the portal with a pediatric context</h2>
          <h4>
            Explore notable dependencies from PedDep Accelerator investigators
            and across the DepMap portal using the new pediatric subtype model
            context
          </h4>
          <PediatricContextExamples />
        </div>
      </div>
      <div className={styles.PeddepPageContainer}>
        <div className={styles.aboutPeddep}>
          <h2>The First Generation Pediatric Dependency Map</h2>
          <div className={styles.aboutPeddepColumns}>
            <div>
              <h4>
                The PedDep initiative started in 2014 with the goal of applying
                the Broad&apos;s DepMap large-scale genetic dependencies and
                drug sensitivity approaches to accelerate the discovery of
                therapeutic targets and strategies for pediatric patients.
              </h4>
              <h4>
                While clinical trials per se are not a component of the PedDep
                project, generating data which would allow the start of clinical
                trials is within the purview. PedDep was developed to generate
                the core data, break down silos, and use the combination of
                expertises to synergize ability to conduct groundbreaking
                research.
              </h4>
              <h4>
                <a
                  href="https://depmap.org/peddep/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read our landmark paper
                </a>{" "}
                in Nature Genetics or visit our{" "}
                <a
                  href="https://depmap.org/peddep/vis-app/index.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  PedDep Explorer
                </a>
                .
              </h4>
            </div>
            <div>{umapImage}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
