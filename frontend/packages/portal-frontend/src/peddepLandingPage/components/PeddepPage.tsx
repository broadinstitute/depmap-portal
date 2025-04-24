import * as React from "react";
import { useEffect, useContext, useState } from "react";
import { Button } from "react-bootstrap";
import { getDapi } from "src/common/utilities/context";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";
import { ApiContext } from "@depmap/api";
import SubGroupPlot from "./SubgroupPlot";

interface PeddepPageProps {}

export default function PeddepPage(props: PeddepPageProps) {
  const { getApi } = useContext(ApiContext);
  const [bapi] = useState(() => getApi());
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const dimensionType = await bapi.getDimensionType(
        "depmap_model_with_peddep"
      );
      console.log(dimensionType);
      const modelSubsetColData = await bapi.getTabularDatasetData(
        dimensionType.metadata_dataset_id,
        { columns: ["OncotreeLineage", "OncotreeSubtype", "PediatricSubtype"] }
      );
      console.log(modelSubsetColData);
      const modelSubsetIndexData: { [key: string]: any } = {};

      // eslint-disable-next-line no-restricted-syntax
      for (const [colName, colData] of Object.entries(modelSubsetColData)) {
        // eslint-disable-next-line no-restricted-syntax
        for (const [index, value] of Object.entries(colData)) {
          if (!modelSubsetIndexData[index]) {
            modelSubsetIndexData[index] = {};
          }
          modelSubsetIndexData[index][colName] = value;
        }
      }
      console.log(modelSubsetIndexData);

      const pedModelData = Object.entries(modelSubsetIndexData).reduce(
        (acc, [model, modelData]) => {
          if (modelData.PediatricSubtype === "True") {
            const subtype = modelData.OncotreeSubtype;
            if (modelData.OncotreeLineage === "CNS/Brain") {
              acc["CNS/Brain"].push(subtype);
            } else if (
              ["Myeloid", "Lymphoid"].includes(modelData.OncotreeLineage)
            ) {
              acc["Heme"].push(subtype);
            } else {
              acc["Solid"].push(subtype);
            }
          }
          return acc;
        },
        { "CNS/Brain": [], Heme: [], Solid: [] }
      );
      console.log(pedModelData);
      setData(pedModelData);
    })();
  }, [bapi]);

  const imagePath = getDapi()._getFileUrl(
    // TODO: Use context?
    "/static/img/peddep_landing_page/pedepwave.png"
  );

  const umapImage = (
    <img
      style={{ float: "right" }}
      src={getDapi()._getFileUrl("/static/img/peddep_landing_page/umap.png")}
      alt="Diagram of UMAP"
    />
  );

  return (
    <div>
      <div
        className={`${styles.PeddepPage} ${styles.highlightBackground}`}
        style={{ backgroundImage: `url(${imagePath})` }}
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
            <Button>Learn more at PedDep.org</Button>
          </div>
        </div>
      </div>
      <hr />
      <div className={styles.PeddepPage}>
        <h2>Our Goals and Focus</h2>
        <h4>
          The PedDep Accelerator is leading a multi-pronged effort against this
          problem focusing both on expanding and extending known successful
          approaches as well as investing in exploratory science with
          transformative potential.
        </h4>
        <div className={styles.dataContainer}>
          <div className={styles.dataInfo}>
            <div>
              <h4>Dependency Screening</h4>
              <h5>
                Developing and deploying CRISPR-based genome editing techniques
                to identify hidden vulnerabilities (dependencies) in a spectrum
                of high-risk childhood brain, solid and hematological
                malignancies.
              </h5>
            </div>
            <div>
              <h4>Omics profiling</h4>
              <h5>
                Leveraging emerging technologies to characterize the genetic and
                epigenetic landscape of pediatric cancers.
              </h5>
            </div>
            <div>
              <h4>Compound screening</h4>
              <h5>
                Developing and deploying CRISPR-based genome editing techniques
                to identify hidden vulnerabilities (dependencies) in a spectrum
                of high-risk childhood brain, solid and hematological
                malignancies.
              </h5>
            </div>
            <div>
              <h4>New Model Derivation</h4>
              <h5>
                Developing model systems where none currently exist for
                high-risk childhood cancers that have poor outcomes.
              </h5>
            </div>
            <div>
              <h4>Data science</h4>
              <h5>
                Developing computational approaches to mine and integrate data
                and developing innovative software tools for data sharing.
              </h5>
            </div>
          </div>
          <div>
            {data
              ? Object.entries(data).map(([subgroup, values]) => {
                  return (
                    <SubGroupPlot
                      key={subgroup}
                      subgroup={subgroup}
                      subtypes={values}
                    />
                  );
                })
              : "Loading..."}
          </div>
        </div>
      </div>
      <hr />
      <div className={styles.PeddepPage}>
        <h2>A Pediatric Context</h2>
        <h4>
          Navigate the portal with a pediatric context. We&apos;ve built this
          context to include models that represent pediatric tumor types.
        </h4>
      </div>
      <hr />
      <div className={styles.PeddepPage}>
        <div className={styles.aboutPeddep}>
          <div>
            <h2>The First Generation Pediatric Dependency Map</h2>
            <h4>
              The PedDep initiative started in 2014 with the goal of applying
              the Broad&apos;s DepMap large-scale genetic dependencies and drug
              sensitivity approaches to accelerate the discovery of therapeutic
              targets and strategies for pediatric patients.
            </h4>
            <h4>
              While clinical trials per se are not a component of the PedDep
              project, generating data which would allow the start of clinical
              trials is within the purview. PedDep was developed to generate the
              core data, break down silos, and use the combination of expertises
              to synergize ability to conduct groundbreaking research.
            </h4>
            <h4>
              Read our landmark paper in Nature Genetics or visit our PedDep
              Explorer.
            </h4>
          </div>
          <div>{umapImage}</div>
        </div>
      </div>
    </div>
  );
}
