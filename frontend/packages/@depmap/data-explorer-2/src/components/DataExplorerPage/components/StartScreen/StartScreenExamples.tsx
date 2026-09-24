import React from "react";
import { DepMap, enabledFeatures, toStaticUrl } from "@depmap/globals";
import StartScreenExample from "./StartScreenExample";
import transcripts from "./examples/transcripts.json";
import public_ from "./examples/public.json";
import styles from "../../styles/DataExplorer2.scss";

const handleClickAdherentGrowthPattern = () => {
  DepMap.saveNewContext({
    name: "Adherent",
    dimension_type: "depmap_model",
    expr: { "==": [{ var: "0" }, "Adherent"] },
    vars: {
      0: {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column" as const,
        identifier: "GrowthPattern",
      },
    },
  });
};

const handleClickSuspensionGrowthPattern = () => {
  DepMap.saveNewContext({
    name: "Suspension",
    dimension_type: "depmap_model",
    expr: { "==": [{ var: "0" }, "Suspension"] },
    vars: {
      0: {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column" as const,
        identifier: "GrowthPattern",
      },
    },
  });
};

function StartScreenExamples() {
  return (
    <div className={styles.StartScreenExamples}>
      {enabledFeatures.show_transcript_example_in_data_explorer && (
        <StartScreenExample
          title="Isoform-level expression of CD44"
          imgSrc={toStaticUrl(
            "img/data_explorer_2/example_thumbnails/cd44-transcripts.png"
          )}
          plot={transcripts["cd44-transcripts"]}
          description={
            <>
              <p>
                CD44 is heavily alternatively spliced, and its isoforms have
                been tied to different roles in EMT, stemness, and metastasis —
                distinctions a gene-level value hides. Long read RNA-seq is
                expanded here into one distribution per transcript.
              </p>
              <p>
                <b>Try:</b> Set <b>Color By</b> to <b>Model Annotation</b> and
                choose lineage to see whether isoform usage tracks with lineage.
              </p>
            </>
          }
        />
      )}

      <StartScreenExample
        title="BRAF dependency vs BRAF inhibitor sensitivity"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/braf-vs-braf-inhibitors.png"
        )}
        plot={public_["braf-vs-braf-inhibitors"]}
        description={
          <>
            <p>
              See whether the models that genetically depend on BRAF are also
              the ones killed by inhibiting it. The y-axis is a context of every
              compound whose annotated target names BRAF, expanded into one
              panel per inhibitor.
            </p>
            <p>
              <b>Try:</b> Use <b>Filter</b> to restrict the plot to skin models
              and see which inhibitors still separate the BRAF-dependent lines.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Expression distribution per lineage"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/expression-distribution-per-lineage.png"
        )}
        plot={public_["expression-distribution-per-lineage"]}
        description={
          <div>
            Compare the expression of SOX10 between lineages to see which
            lineages express this gene and which do not.
          </div>
        }
      />

      <StartScreenExample
        title="Biomarker relationship"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/biomarker-relationship-v2.png"
        )}
        plot={public_["biomarker-relationship"]}
        description={
          <>
            <p>
              A Data Explorer 1-style plot showing the relationship between
              VPS4B absolute copy number and VPS4A CRISPR gene effect.
            </p>
            <p>
              <b>Try</b>: Color points by VPS4B expression by choosing{" "}
              <b>Color By</b> and <b>Custom</b>.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Context-specific dependencies"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/context-specific-dependencies.png"
        )}
        plot={public_["context-specific-dependencies"]}
        description={
          <>
            <p>
              Compare EMT-high to EMT-low adherent models to find the
              mesenchymal-specific dependencies.
            </p>
            <p>
              <b>Try:</b> Use the <b>Visualize</b> button to see correlations
              between these dependencies.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Context-specific expression"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/context-specific-expression.png"
        )}
        plot={public_["context-specific-expression"]}
        description={
          <>
            <p>
              Find which genes have lower or higher expression in adherent
              models with RB1 loss of function (damaging or hotspot mutations,
              or copy number loss).
            </p>
            <p>
              <b>Try:</b> Edit the RB1Loss and NoRB1Loss contexts to include
              organoid models, and see how the results change.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Compare expression distributions"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/compare-expression-distributions-v2.png"
        )}
        plot={public_["compare-expression-distributions"]}
        description={
          <>
            <p>
              Compare the distribution of HER2 expression levels in HER2
              amplified breast cancer vs non-HER2 amplified breast cancer.
            </p>
            <p>
              <b>Try:</b> Select the non-HER2 amplified models with the highest
              HER2 expression and save them as a new model context for further
              analysis.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Mean expression vs mean CRISPR gene effect"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/mean-expression-vs-mean-crispr-gene-effect.png"
        )}
        plot={public_["mean-expression-vs-mean-crispr-gene-effect"]}
        description={
          <>
            <p>
              Show that nearly every common essential gene has high average
              expression, but not vice versa.
            </p>
            <p>
              <b>Try:</b> Change the x-axis to be CRISPR Gene Dependency instead
              of CRISPR Gene Effect.
            </p>
          </>
        }
      />

      <StartScreenExample
        title="Correlation structure of dependencies"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/correlation-structure-of-dependencies.png"
        )}
        plot={public_["correlation-structure-of-dependencies"]}
        description={
          <>
            <p>
              Find which members of the de novo pyrimidine biosynthesis pathway
              have correlated dependencies using a correlation heatmap.
            </p>
            <p>
              <b>Try:</b> Use <b>Distinguish</b> and define contexts to split
              the correlation heatmap into two heatmaps: one showing correlation
              within models with an{" "}
              <button
                type="button"
                className={styles.pseudoLink}
                onClick={handleClickAdherentGrowthPattern}
              >
                adherent growth pattern
              </button>
              , and one for models with a{" "}
              <button
                type="button"
                className={styles.pseudoLink}
                onClick={handleClickSuspensionGrowthPattern}
              >
                suspension growth pattern
              </button>
              .
            </p>
          </>
        }
      />
    </div>
  );
}

export default StartScreenExamples;
