/* eslint-disable no-continue */
import { useEffect, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import type { Dataset, TabularDataset, MatrixDataset } from "@depmap/types";
import type { DimensionTypeDescriptor, TableDescriptor } from "./types";
import { buildDimTypeMap, buildTablesByDim } from "./schemaHelpers";

/**
 * A source entry for Widget 1, representing either a tabular or matrix
 * annotation dataset.
 */
export interface SourceTable {
  id: string;
  given_id: string | null;
  format: "tabular_dataset" | "matrix_dataset";
  name: string;
  displayName: string;
  isPrimary: boolean;
  /** Number of non-FK, non-label columns. 0 for matrix datasets. */
  columnCount: number;
  /** Number of FK columns. 0 for matrix datasets. */
  fkCount: number;
  /** Column metadata. Empty for matrix datasets. */
  columns: TableDescriptor["columns"];
  /** The opposite axis dim type name (for SliceSelect). Only set for matrix datasets. */
  sliceType: string | null;
  /** The identifier type for the opposite axis. Only set for matrix datasets. */
  identifierType: "feature_id" | "sample_id" | null;
}

/**
 * The accepted data_type values for annotation sources.
 */
const ANNOTATION_DATA_TYPES = new Set(["Annotations", "metadata"]);

/**
 * Fetches dimension types and datasets, then derives everything needed
 * for the annotation selector: source tables (tabular + matrix),
 * tablesByDim for FK chain walking, and dimension type display names.
 */
export default function useChainSelectorData(index_type: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [dimTypes, setDimTypes] = useState<DimensionTypeDescriptor[]>([]);
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);

      const [types, datasets] = await Promise.all([
        cached(breadboxAPI).getDimensionTypes(),
        cached(breadboxAPI).getDatasets(),
      ]);

      if (cancelled) return;

      setDimTypes(types);
      setAllDatasets(datasets);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [index_type]);

  // Map from dim type name → descriptor.
  const dimTypeMap = useMemo(() => buildDimTypeMap(dimTypes), [dimTypes]);

  // All tabular datasets (any dim type) for FK chain walking.
  const tabularDatasets = useMemo(() => {
    return allDatasets.filter(
      (d) => d.format === "tabular_dataset"
    ) as TabularDataset[];
  }, [allDatasets]);

  // All tabular datasets grouped by index_type_name → TableDescriptor[].
  const tablesByDim = useMemo(() => buildTablesByDim(allDatasets), [
    allDatasets,
  ]);

  // The primary metadata dataset ID for this index type.
  const metadataDatasetId = dimTypeMap[index_type]?.metadata_dataset_id ?? null;
  const axis = dimTypeMap[index_type]?.axis ?? null;

  // Source tables for Widget 1: tabular datasets at this index type,
  // plus matrix annotation datasets whose axis matches.
  const sourceTables: SourceTable[] = useMemo(() => {
    const sources: SourceTable[] = [];

    // Tabular datasets at this index type.
    for (const d of tabularDatasets) {
      if (d.index_type_name !== index_type) continue;

      const isPrimary = d.id === metadataDatasetId;
      const cols = d.columns_metadata;
      const colEntries = Object.entries(cols).filter(
        ([name]) => name !== "label"
      );
      const fkCount = colEntries.filter(([, meta]) => meta.references != null)
        .length;

      sources.push({
        id: d.id,
        given_id: d.given_id,
        format: "tabular_dataset",
        name: d.name,
        displayName: isPrimary ? "Primary Annotations" : d.name,
        isPrimary,
        columnCount: colEntries.length - fkCount,
        fkCount,
        columns: cols,
        sliceType: null,
        identifierType: null,
      });
    }

    // Matrix annotation datasets whose axis-specific dim type matches.
    if (axis) {
      const axisKey =
        axis === "sample" ? "sample_type_name" : "feature_type_name";
      const oppositeKey =
        axis === "sample" ? "feature_type_name" : "sample_type_name";
      const oppositeIdentifierType =
        axis === "sample" ? "feature_id" : "sample_id";

      for (const d of allDatasets) {
        if (d.format !== "matrix_dataset") continue;

        const md = d as MatrixDataset;

        // Must be an annotation, must match this dim type, and must not
        // be the primary metadata dataset.
        if (
          !ANNOTATION_DATA_TYPES.has(md.data_type) ||
          md[axisKey] !== index_type ||
          md.id === metadataDatasetId
        ) {
          continue;
        }

        sources.push({
          id: md.id,
          given_id: md.given_id,
          format: "matrix_dataset",
          name: md.name,
          displayName: md.name,
          isPrimary: false,
          columnCount: 0,
          fkCount: 0,
          columns: {},
          sliceType: md[oppositeKey] ?? null,
          identifierType: oppositeIdentifierType,
        });
      }
    }

    // Sort: primary first, then tabular alphabetically, then matrix.
    sources.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.format !== b.format) {
        return a.format === "tabular_dataset" ? -1 : 1;
      }
      return a.displayName
        .toLowerCase()
        .localeCompare(b.displayName.toLowerCase());
    });

    return sources;
  }, [tabularDatasets, allDatasets, index_type, metadataDatasetId, axis]);

  return {
    isLoading,
    dimTypeMap,
    tablesByDim,
    sourceTables,
  };
}
