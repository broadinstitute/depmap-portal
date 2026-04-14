import React, { useMemo } from "react";
import ReactSelect from "react-select";
import extendReactSelect from "../../utils/extend-react-select";
import type { SourceTable } from "./useChainSelectorData";
import showAnnotationDetailsModal from "./showAnnotationDetailsModal";

const Select = extendReactSelect(ReactSelect);

interface SourceOption {
  value: string;
  label: string;
  sourceTable: SourceTable;
}

interface Props {
  sourceTables: SourceTable[];
  selectedSourceId: string | null;
  onSelect: (table: SourceTable) => void;
  menuPortalTarget?: HTMLElement | null;
  /** Show a loading indicator in the select. */
  isLoading?: boolean;
}

/**
 * AnnotationSourcePicker — react-select based dropdown for selecting
 * an annotation source (tabular or matrix dataset).
 */
export default function AnnotationSourcePicker({
  sourceTables,
  selectedSourceId,
  onSelect,
  menuPortalTarget = undefined,
  isLoading = undefined,
}: Props) {
  const options: SourceOption[] = useMemo(() => {
    return sourceTables.map((t) => ({
      value: t.id,
      label: t.displayName,
      sourceTable: t,
    }));
  }, [sourceTables]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === selectedSourceId) ?? null;
  }, [options, selectedSourceId]);

  return (
    <Select
      label="Annotation Source"
      renderDetailsButton={() => (
        <button
          type="button"
          disabled={!selectedSourceId}
          onClick={() => {
            showAnnotationDetailsModal(selectedSourceId!);
          }}
        >
          details
        </button>
      )}
      value={selectedOption}
      options={options}
      onChange={(option) => {
        if (option) {
          onSelect((option as SourceOption).sourceTable);
        }
      }}
      isSearchable={false}
      isClearable={false}
      tabSelectsValue={false}
      isLoading={isLoading}
      isDisabled={isLoading}
      menuPortalTarget={menuPortalTarget}
    />
  );
}
