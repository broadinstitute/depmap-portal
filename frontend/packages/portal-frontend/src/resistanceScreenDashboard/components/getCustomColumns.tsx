import React, { ComponentProps } from "react";
import SliceTable from "@depmap/slice-table";
import { ScreenPairMetadata } from "src/pairedScreens/hooks/useMetadata";
import DependencyLinksHeader from "src/pairedScreens/components/DependencyLinksHeader";
import DependencyLinksCell from "src/pairedScreens/components/DependencyLinksCell";
import ModelScatterLink from "./ModelScatterLink";

function getCustomColumns(
  metadata: ScreenPairMetadata | null
): ComponentProps<typeof SliceTable>["customColumns"] {
  return [
    // Dependency volcano / scatter
    {
      width: 148,
      header: () => (
        <DependencyLinksHeader
          heading={
            <>
              <b>Dependency</b> in parental vs. resistant
            </>
          }
          tooltipTitle="Comparing parental to resistant model"
          tooltipContent={
            <ul>
              <li>
                The “volcano” links will show a volcano plot of the differential
                dependency analysis produced by Chronos-compare. The x-axis
                shows difference in gene effect, negative values indicate
                greater dependency in the parental vs. resistance model.
              </li>
              <br />
              <li>
                The “scatter” links will show a scatter plot of the parental vs
                the resistance model gene effects.
              </li>
            </ul>
          }
        />
      ),
      cell: ({ row }) => (
        <DependencyLinksCell
          pairId={row.id}
          metadata={metadata}
          volcanoXDataset="PairedResGeneEffectDiff"
          volcanoYDataset="PairedResGeneEffectFDR"
        />
      ),
    },

    // Expression scatter
    {
      width: 115,
      header: () => (
        <DependencyLinksHeader
          heading={
            <>
              <b>Expression</b> in parental vs. resistant
            </>
          }
          tooltipTitle="Comparing parental to resistant model"
          tooltipContent={
            <ul>
              The “scatter” links will show a scatter plot of the parental vs
              the resistance model gene expression.
            </ul>
          }
        />
      ),
      cell: (_, getValue) => {
        return <ModelScatterLink dataset_id="expression" getValue={getValue} />;
      },
    },

    // Copy number scatter
    {
      width: 115,
      header: () => (
        <DependencyLinksHeader
          heading={
            <>
              <b>Copy Number</b> in parental vs. resistant
            </>
          }
          tooltipTitle="Comparing parental to resistant model"
          tooltipContent={
            <ul>
              The “scatter” links will show a scatter plot of the parental vs
              the resistance model copy number.
            </ul>
          }
        />
      ),
      cell: (_, getValue) => {
        return (
          <ModelScatterLink
            dataset_id="copy_number_relative"
            getValue={getValue}
          />
        );
      },
    },
  ];
}

export default getCustomColumns;
