import React from "react";
import { DataExplorerPlotConfig } from "@depmap/types";
import { saveNewContext } from "src/index";
import { toStaticUrl } from "src/common/utilities/context";
import StartScreenExample from "src/data-explorer-2/components/StartScreen/StartScreenExample";
import examples from "src/data-explorer-2/components/StartScreen/examples.json";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

const handleClickAdherentGrowthPattern = () => {
  saveNewContext({
    name: "Adherent",
    context_type: "depmap_model",
    expr: {
      "==": [{ var: "slice/growth_pattern/all/label" }, "Adherent"],
    },
  });
};

const handleClickSuspensionGrowthPattern = () => {
  saveNewContext({
    name: "Suspension",
    context_type: "depmap_model",
    expr: {
      "==": [{ var: "slice/growth_pattern/all/label" }, "Suspension"],
    },
  });
};

function StartScreenExamples() {
  return (
    <div className={styles.StartScreenExamples}>
      <StartScreenExample
        title="Biomarker relationship"
        imgSrc={toStaticUrl(
          "img/data_explorer_2/example_thumbnails/biomarker-relationship-v2.png"
        )}
        plot={examples["biomarker-relationship"] as DataExplorerPlotConfig}
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
        plot={
          examples["context-specific-dependencies"] as DataExplorerPlotConfig
        }
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
        plot={examples["context-specific-expression"] as DataExplorerPlotConfig}
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
          "img/data_explorer_2/example_thumbnails/compare-expression-distributions.png"
        )}
        plot={
          examples["compare-expression-distributions"] as DataExplorerPlotConfig
        }
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
        plot={
          examples[
            "mean-expression-vs-mean-crispr-gene-effect"
          ] as DataExplorerPlotConfig
        }
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
        plot={
          examples[
            "correlation-structure-of-dependencies"
          ] as DataExplorerPlotConfig
        }
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
