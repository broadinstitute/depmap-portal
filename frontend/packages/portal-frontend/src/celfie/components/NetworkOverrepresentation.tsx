import * as React from "react";
import { colorPalette } from "depmap-shared";
import { NetworkPlot } from "src/plot/components/NetworkPlot";
import LongTableOverrepresentation from "src/celfie/components/LongTableOverrepresentation";
import { ConstellationGraphInputs } from "src/constellation/models/constellation";
import "src/celfie/styles/celfie.scss";
import { Button } from "react-bootstrap";
import { CustomCellRendererInputs } from "@depmap/long-table";
import { PlotHTMLElement, PlotlyDragmode } from "@depmap/plotly-wrapper";

export interface NetworkOverrepresentationProps {
  graphData: ConstellationGraphInputs;
  isLoading: boolean;
  dataOptions: Partial<Plotly.PlotData>;
  graphLayout?: Partial<Plotly.Layout>;
  onPointClick?: (point: Plotly.PlotDatum) => void;
  onButtonClickLongTable: (input: CustomCellRendererInputs) => void;
  dragmodeWidgetOptions?: Array<PlotlyDragmode>;
}

export const NetworkOverrepresentation = React.forwardRef(
  (props: NetworkOverrepresentationProps, ref) => {
    const {
      graphData,
      isLoading,
      dataOptions,
      graphLayout,
      onPointClick,
      dragmodeWidgetOptions,
    } = props;

    const numFormatFunction = (num: number) => {
      return num;
    };

    const buttonRenderer = (input: any) => {
      // frozenRow index -1 is the type row
      if (input.rowData.id !== "frozenRow" && input.rowIndex >= 0) {
        const { onButtonClickLongTable } = props;
        return (
          <Button
            bsSize="xs"
            onClick={() => {
              onButtonClickLongTable(input);
            }}
            active
          >
            Highlight
          </Button>
        );
      }
      return null;
    };

    const genesetRenderer = ({
      rowData,
      cellData,
    }: CustomCellRendererInputs) => {
      if (
        rowData.id !== "frozenRow" &&
        rowData.id !== "nullRow" &&
        rowData.id != null
      ) {
        // remove new line characters
        const geneset = cellData.replace(/\n/g, "");
        // add hovertext using title attribute
        return <div title={geneset}>{geneset}</div>;
      }

      if (cellData === undefined) {
        return null;
      }
      return cellData;
    };

    return (
      <>
        <div className="celfie-wrapper" style={{ height: "600px" }}>
          <p>
            <i>
              A network view of the top associated genes and their relationships
            </i>
          </p>
          <NetworkPlot
            ref={ref as React.RefObject<PlotHTMLElement>}
            nodes={graphData.network.nodes}
            edges={graphData.network.edges}
            dataOptions={dataOptions}
            layoutOptions={graphLayout}
            onPointClick={onPointClick}
            dragmodeWidgetOptions={dragmodeWidgetOptions}
          />
          {isLoading ? (
            <div className="loading" style={{ height: "600px" }}>
              <div>
                <b>Loading...</b>
              </div>
            </div>
          ) : null}
        </div>

        <div className="celfie-wrapper" style={{ height: "400px" }}>
          <p>
            <i>
              Gene set overrepresentation of selected positively and negatively
              associated genes
            </i>
          </p>
          <LongTableOverrepresentation
            geneSetsUp={graphData.overrepresentation.gene_sets_up}
            geneSetsDown={graphData.overrepresentation.gene_sets_down}
            columns={[
              {
                key: "idCol",
                displayName: "idCol",
              },
              {
                key: "highlightButton",
                displayName: "Highlight",
                cellRenderer: buttonRenderer,
                helperText: <p>Highlight the genes in the selected gene set</p>,
              },
              {
                key: "direction",
                displayName: "Cor Sign",
                colorMap: new Map<string, string>([
                  ["Pos", colorPalette.positive_color],
                  ["Neg", colorPalette.negative_color],
                ]),
                helperText: (
                  <p>
                    Whether the positively <i>(pos)</i> or negatively{" "}
                    <i>(neg)</i> associated genes from the top N{" "}
                    <i>(selected using the Number of genes dropdown)</i> are
                    used
                  </p>
                ),
              },
              {
                key: "geneset",
                displayName: "Geneset",
                type: "character",
                cellRenderer: genesetRenderer,
                helperText: (
                  <p>
                    Gene sets from{" "}
                    <a href="https://www.gsea-msigdb.org/gsea/msigdb/collections.jsp">
                      MSigDB
                    </a>
                    ’s C2 Canonical Pathways (v7.0) and Hallmark (v7.1) gene set
                    collections
                  </p>
                ),
              },
              {
                key: "negLogP",
                displayName: "-log10(P-Value)",
                helperText: (
                  <p>
                    Overrepresentation p-value calculated using Fisher’s exact
                    test
                  </p>
                ),
              },
              {
                key: "setSize",
                displayName: "Set size",
                numberFormatFunction: numFormatFunction,
                helperText: (
                  <p>The number of genes within a particular gene set</p>
                ),
              },
            ]}
          />
          {isLoading ? (
            <div className="loading" style={{ height: "400px" }}>
              <div>
                <b>Loading...</b>
              </div>
            </div>
          ) : null}
        </div>
      </>
    );
  }
);

NetworkOverrepresentation.defaultProps = {
  graphLayout: undefined,
  onPointClick: () => {},
  dragmodeWidgetOptions: undefined,
};
