import React from "react";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/GeneTea.scss";
import TutorialExample from "./TutorialExample";

function TutorialExamples() {
  return (
    <div className={styles.TutorialExamples}>
      <TutorialExample
        title="Start From a List of Genes"
        imgSrc={toStaticUrl(
          "img/genetea/example_thumbnails/alpha_fold_2_example.png"
        )}
        geneList={["EFCAB9", "GCA", "PDCD6"]}
        description={
          <>
            <p>
              EFCAB9, GCA, and PDCD6 were identified by Barrio-Hernandez et al.
              2023 as a cluster of genes encoding proteins with similar
              AlphaFold2 predictions… what common feature do they share?{" "}
            </p>
            <p>
              <b>Try</b>: using the search bar to find other genes matching the
              term “~ EF hand”. Pre-populates the text box with those 3 genes.
            </p>
          </>
        }
      />

      <TutorialExample
        title="Investigate a Gene Context"
        imgSrc={toStaticUrl(
          "img/genetea/example_thumbnails/gene_context_example.png"
        )}
        geneList={[
          "CHMP4B",
          "ELMO2",
          "FERMT2",
          "FGFR1",
          "ITGAV",
          "JUN",
          "MSTO1",
          "NHLRC2",
          "PPP2R1A",
          "RPP25L",
          "SEPSECS",
          "TUBB",
        ]}
        description={
          <>
            <p>
              You have created a Gene Context containing the
              mesenchymal-specific dependencies from the Data Explorer example
              “Context-specific dependencies”. Is there a consistent biological
              signal amongst these dependencies?
            </p>
            <p>
              <b>Try:</b> clicking on a bar in the Top Terms plot to see the
              text excerpts corresponding to the terms. Loads a Gene Context
              containing:
            </p>
            <p style={{ wordWrap: "break-word" }}>
              CHMP4B,ELMO2,FERMT2,FGFR1,ITGAV,JUN,MSTO1,NHLRC2,PPP2R1A,RPP25L,SEPSECS,TUBB
            </p>
          </>
        }
      />

      <TutorialExample
        title="Examine Functional Modules"
        imgSrc={toStaticUrl(
          "img/genetea/example_thumbnails/functional_models_example.png"
        )}
        geneList={[
          "ABCB7",
          "ACAA1",
          "ACAA2",
          "ACADM",
          "ACADSB",
          "ACADVL",
          "ACAT1",
          "ACO2",
          "AFG3L2",
          "AIFM1",
          "ALAS1",
          "ALDH6A1",
          "ATP1B1",
          "ATP5F1A",
          "ATP5F1B",
          "ATP5F1C",
          "ATP5F1D",
          "ATP5F1E",
          "ATP5PB",
          "ATP5MC1",
          "ATP5MC2",
          "ATP5MC3",
          "ATP5PD",
          "ATP5ME",
          "ATP5PF",
          "ATP5MF",
          "ATP5MG",
          "ATP5PO",
          "ATP6AP1",
          "ATP6V0B",
          "ATP6V0C",
          "ATP6V0E1",
          "ATP6V1C1",
          "ATP6V1D",
          "ATP6V1E1",
          "ATP6V1F",
          "ATP6V1G1",
          "ATP6V1H",
          "BAX",
          "BCKDHA",
          "BDH2",
          "MPC1",
          "CASP7",
          "COX10",
          "COX11",
          "COX15",
          "COX17",
          "COX4I1",
          "COX5A",
          "COX5B",
          "COX6A1",
          "COX6B1",
          "COX6C",
          "COX7A2",
          "COX7A2L",
          "COX7B",
          "COX7C",
          "COX8A",
          "CPT1A",
          "CS",
          "CYB5A",
          "CYB5R3",
          "CYC1",
          "CYCS",
          "DECR1",
          "DLAT",
          "DLD",
          "DLST",
          "ECH1",
          "ECHS1",
          "ECI1",
          "ETFA",
          "ETFB",
          "ETFDH",
          "FDX1",
          "FH",
          "FXN",
          "GLUD1",
          "GOT2",
          "GPI",
          "GPX4",
          "GRPEL1",
          "HADHA",
          "HADHB",
          "HCCS",
          "HSD17B10",
          "HSPA9",
          "HTRA2",
          "IDH1",
          "IDH2",
          "IDH3A",
          "IDH3B",
          "IDH3G",
          "IMMT",
          "ISCA1",
          "ISCU",
          "LDHA",
          "LDHB",
          "LRPPRC",
          "MAOB",
          "MDH1",
          "MDH2",
          "MFN2",
          "MGST3",
          "MRPL11",
          "MRPL15",
          "MRPL34",
          "MRPL35",
          "MRPS11",
          "MRPS12",
          "MRPS15",
          "MRPS22",
          "MRPS30",
          "MTRF1",
          "MTRR",
          "MTX2",
          "NDUFA1",
          "NDUFA2",
          "NDUFA3",
          "NDUFA4",
          "NDUFA5",
          "NDUFA6",
          "NDUFA7",
          "NDUFA8",
          "NDUFA9",
          "NDUFAB1",
          "NDUFB1",
          "NDUFB2",
          "NDUFB3",
          "NDUFB4",
          "NDUFB5",
          "NDUFB6",
          "NDUFB7",
          "NDUFB8",
          "NDUFC1",
          "NDUFC2",
          "NDUFC1",
          "NDUFC2",
          "NDUFS1",
          "NDUFS2",
          "NDUFS3",
          "NDUFS4",
          "NDUFS6",
          "NDUFS7",
          "NDUFS8",
          "NDUFV1",
          "NDUFV2",
          "NNT",
          "NQO2",
          "OAT",
          "OGDH",
          "OPA1",
          "OXA1L",
          "PDHA1",
          "PDHB",
          "PDHX",
          "PDK4",
          "PDP1",
          "PHB2",
          "PHYH",
          "PMPCA",
          "POLR2F",
          "POR",
          "PRDX3",
          "RETSAT",
          "RHOT1",
          "RHOT2",
          "SDHA",
          "SDHB",
          "SDHC",
          "SDHD",
          "SLC25A11",
          "SLC25A12",
          "SLC25A20",
          "SLC25A3",
          "SLC25A4",
          "SLC25A5",
          "SLC25A6",
          "SUCLA2",
          "SUCLG1",
          "SUPV3L1",
          "SURF1",
          "TCIRG1",
          "TIMM10",
          "TIMM13",
          "TIMM17A",
          "TIMM50",
          "TIMM8B",
          "TIMM9",
          "TOMM22",
          "TOMM70",
          "UQCR10",
          "UQCR11",
          "UQCRB",
          "UQCRC1",
          "UQCRC2",
          "UQCRFS1",
          "UQCRH",
          "UQCRQ",
          "VDAC1",
          "VDAC2",
          "VDAC3",
        ]}
        description={
          <>
            {" "}
            <p>
              The Hallmark Oxidative Phosphorylation contains 200 genes; see how
              they cluster by function.
            </p>
            <p>
              <b>Try:</b> Zooming in on a module of genes using the heatmap
              navigation bar, then selecting a subset to create a new Gene
              Context. Pre-populates the text box using the hallmark gene set.
            </p>
          </>
        }
      />
    </div>
  );
}

export default TutorialExamples;
