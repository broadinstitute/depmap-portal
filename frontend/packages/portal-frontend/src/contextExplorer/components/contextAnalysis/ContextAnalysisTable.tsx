import React, { useCallback, useEffect, useState } from "react";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import { toPortalLink } from "@depmap/globals";
import {
  ContextAnalysisTableType,
  ContextExplorerDatasets,
} from "@depmap/types";
import WideTable from "@depmap/wide-table";
import { ContextAnalysisTableRow } from "src/contextExplorer/models/types";
import { getSelectivityValLabel } from "src/contextExplorer/utils";

interface ContextAnalysisTableProps {
  data: ContextAnalysisTableType | null;
  pointVisibility: boolean[];
  handleSelectRowAndPoint: (entityLabel: string) => void;
  selectedTableLabels: Set<string> | null;
  entityType: string;
  datasetId: ContextExplorerDatasets;
}

function ContextAnalysisTable(props: ContextAnalysisTableProps) {
  const {
    data,
    pointVisibility,
    handleSelectRowAndPoint,
    selectedTableLabels,
    entityType,
    datasetId,
  } = props;

  const [formattedData, setFormattedData] = useState<
    ContextAnalysisTableRow[] | undefined
  >();

  const getTrProps = useCallback(() => {
    const className = "striped-row";
    return {
      className,
    };
  }, []);

  const [columns, setColumns] = useState<any>(undefined);

  useEffect(() => {
    const iData = [];
    const entityLabelMap: { [entity: string]: string } = {};
    if (data) {
      for (let index = 0; index < data?.entity.length; index++) {
        if (pointVisibility[index]) {
          if (entityType === "gene") {
            iData.push({
              entity: data.entity[index],
              tTestQVal: data.t_qval[index],
              inContextMean: data.mean_in[index],
              outGroupMean: data.mean_out[index],
              effectSize: data.effect_size[index],
              fractionInContextLinesDependent: data.frac_dep_in[index],
              fractionOutGroupLinesDependent: data.frac_dep_out[index],
              selectivityVal: data.selectivity_val[index],
            });
          } else {
            iData.push({
              entity: data.entity[index],
              tTestQVal: data.t_qval[index],
              inContextMean: data.mean_in[index],
              outGroupMean: data.mean_out[index],
              effectSize: data.effect_size[index],
              selectivityVal: data.selectivity_val[index],
            });
          }

          entityLabelMap[data.entity[index]] = data.label[index];
        }
      }
    }
    setFormattedData(iData);

    const renderFilterPlaceholder = ({
      column: { filterValue, setFilter },
    }: any) => {
      return (
        <input
          type="text"
          placeholder={`Search...`}
          value={filterValue || ""}
          onChange={(event) => setFilter(event.target.value || undefined)}
          style={{ width: "90%", fontSize: "12px" }}
        />
      );
    };

    const selectivityValLabel = getSelectivityValLabel(entityType);

    const getDrugInGroupLabel = () => {
      if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
        // Keep this as AUC regardless of what the units of Prism_oncology_AUC are because
        // get_context_analysis outputs these results and should always use AUC (rather than log2(AUC))
        return `In-context mean AUC`;
      }

      return "In-context mean log2(viability)";
    };

    const getDrugOutGroupLabel = () => {
      if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
        // Keep this as AUC regardless of what the units of Prism_oncology_AUC are because
        // get_context_analysis outputs these results and should always use AUC (rather than log2(AUC))
        return `Out-group mean AUC`;
      }
      return "Out-group mean log2(viability)";
    };

    let initialCols = [
      {
        accessor: "entity",
        Header: entityType === "gene" ? "Gene" : "Drug",
        id: "entity",
        maxWidth: 120,
        minWidth: 120,
        customFilter: renderFilterPlaceholder,
        Cell: (row: any) => (
          <a
            href={toPortalLink(
              `/${entityType}/${entityLabelMap[row.value] as string}`
            )}
            target="_blank"
            rel="noreferrer"
            key={row.value}
            style={{ textDecoration: "underline" }}
          >
            {row.value}
          </a>
        ),
      },
      {
        accessor: "selectivityVal",
        id: "selectivityVal",
        Header: selectivityValLabel,
        maxWidth: 90,
        minWidth: 90,
      },
      {
        accessor: "tTestQVal",
        id: "tTestQVal",
        Header: "T-test q-value",
        maxWidth: 90,
        minWidth: 90,
        disableFilters: true,
      },
      {
        accessor: "effectSize",
        id: "effectSize",
        Header: "Effect Size",
        maxWidth: 90,
        minWidth: 90,
        disableFilters: true,
      },
      {
        accessor: "inContextMean",
        id: "inContextMean",
        Header:
          entityType === "gene"
            ? "In-context mean gene effect"
            : getDrugInGroupLabel(),
        maxWidth: 90,
        minWidth: 90,
        disableFilters: true,
      },
      {
        accessor: "outGroupMean",
        id: "outGroupMean",
        Header:
          entityType === "gene"
            ? "Out-group mean gene effect"
            : getDrugOutGroupLabel(),
        maxWidth: 90,
        minWidth: 90,
        disableFilters: true,
      },
    ];

    if (entityType === "gene") {
      const geneOnlyColumns = [
        {
          accessor: "fractionInContextLinesDependent",
          id: "fractionInContextLinesDependent",
          Header:
            entityType === "gene"
              ? "Fraction of in-context lines dependent"
              : "Fraction in-context lines sensitive",
          maxWidth: 90,
          minWidth: 90,

          disableFilters: true,
        },
        {
          accessor: "fractionOutGroupLinesDependent",
          id: "fractionOutGroupLinesDependent",
          Header:
            entityType === "gene"
              ? "Fraction of out-group lines dependent"
              : "Fraction of out-group lines sensitive",
          maxWidth: 90,
          minWidth: 90,
          disableFilters: true,
        },
      ];

      initialCols = [...initialCols, ...geneOnlyColumns];
    }
    setColumns(initialCols);
  }, [data, pointVisibility, entityType, datasetId]);

  const handleChangeSelection = (selections: string[]) => {
    handleSelectRowAndPoint(selections[0]);
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.geneDepTable}>
        {columns && (
          <WideTable
            idProp={"entity"}
            rowHeight={28}
            data={formattedData}
            columns={columns}
            getTrProps={getTrProps}
            onChangeSelections={handleChangeSelection}
            selectedTableLabels={selectedTableLabels}
            allowDownloadFromTableDataWithMenuFileName="context-explorer.csv"
            singleSelectionMode
            allowDownloadFromTableDataWithMenu
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(ContextAnalysisTable);
