/* eslint-disable
jsx-a11y/no-static-element-interactions,
jsx-a11y/click-events-have-key-events,
no-nested-ternary */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WordBreaker } from "@depmap/common-components";
import { SliceQuery } from "@depmap/types";
import type {
  ChainHop,
  ColumnEntry,
  DimensionTypeDescriptor,
  Door,
  SupplementalTable,
  TableDescriptor,
} from "./types";
import type { SourceTable } from "./useChainSelectorData";
import DimBadge, { dimColorStyle } from "./DimBadge";
import TableBadge from "./TableBadge";
import { ChevronRight, CaretDown, RemoveIcon } from "./icons";
import computeLevel, { groupColumns, LevelResult } from "./computeLevel";
import {
  buildSliceQuery,
  deriveNavStateFromValue,
  displayLabelFromNavState,
  SliceQuerySet,
} from "./sliceQueryUtils";
import MenuPortal from "./MenuPortal";
import useMenuPlacement from "./useMenuPlacement";
import ConditionalTooltip from "./ConditionalTooltip";
import styles from "../../styles/AnnotationSelect.scss";

interface Props {
  index_type: string;
  value: SliceQuery | null;
  onChange: (value: SliceQuery | null) => void;
  tablesByDim: Record<string, TableDescriptor[]>;
  dimTypeMap: Record<string, DimensionTypeDescriptor>;
  selectedSource?: SourceTable;
  menuPortalTarget?: HTMLElement | null;
  disabledSlices?: SliceQuery[];
  hiddenSlices?: SliceQuery[];
  /** Show a loading state in the trigger. */
  isLoading?: boolean;
}

interface SelectedSupplementalTable {
  tableId: string;
  tableName: string;
  dimType: string;
  dimDisplayName: string;
}

interface FocusableItem {
  columnName: string;
  columnEntry: ColumnEntry | null;
  disabled: boolean;
}

export default function ChainColumnPicker({
  index_type,
  value,
  onChange,
  tablesByDim,
  dimTypeMap,
  selectedSource = undefined,
  menuPortalTarget = undefined,
  disabledSlices = undefined,
  hiddenSlices = undefined,
  isLoading = undefined,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [hops, setHops] = useState<ChainHop[]>([]);
  const [
    supplementalTable,
    setSupplementalTable,
  ] = useState<SelectedSupplementalTable | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isTruncated, setIsTruncated] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownElRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusedItemRef = useRef<HTMLDivElement>(null);
  const dropdownBodyRef = useRef<HTMLDivElement>(null);
  const displayLabelRef = useRef<HTMLSpanElement>(null);

  const { placement, maxHeight } = useMenuPlacement(triggerRef.current, isOpen);

  // ── Disabled/hidden slice sets ──

  const disabledSet = useMemo(() => {
    return new SliceQuerySet(disabledSlices ?? []);
  }, [disabledSlices]);

  const hiddenSet = useMemo(() => {
    return new SliceQuerySet(hiddenSlices ?? []);
  }, [hiddenSlices]);

  /**
   * Builds the hypothetical SliceQuery for a column entry (used to check
   * disabled/hidden status without actually selecting it).
   */
  const buildQueryForColumn = useCallback(
    (
      columnName: string,
      columnEntry: ColumnEntry | null
    ): SliceQuery | null => {
      if (!selectedSource) return null;

      return buildSliceQuery(
        columnName,
        columnEntry,
        hops,
        supplementalTable,
        selectedSource,
        index_type,
        tablesByDim,
        dimTypeMap
      );
    },
    [
      hops,
      supplementalTable,
      selectedSource,
      index_type,
      tablesByDim,
      dimTypeMap,
    ]
  );

  const isColumnDisabled = useCallback(
    (columnName: string, columnEntry: ColumnEntry | null): boolean => {
      if (disabledSet.size === 0) return false;

      const query = buildQueryForColumn(columnName, columnEntry);
      return query !== null && disabledSet.has(query);
    },
    [disabledSet, buildQueryForColumn]
  );

  const isColumnHidden = useCallback(
    (columnName: string, columnEntry: ColumnEntry | null): boolean => {
      if (hiddenSet.size === 0) return false;

      const query = buildQueryForColumn(columnName, columnEntry);
      return query !== null && hiddenSet.has(query);
    },
    [hiddenSet, buildQueryForColumn]
  );

  // ── Dropdown lifecycle ──

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      // Close if click is outside both the trigger area and the dropdown.
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownElRef.current || !dropdownElRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (displayLabelRef.current) {
      const el = displayLabelRef.current;
      const parentEl = el.parentElement;
      setIsTruncated(el.clientWidth >= parentEl!.clientWidth);
    }
  }, [value]);

  // ── Chain navigation ──

  const currentDimType =
    hops.length > 0 ? hops[hops.length - 1].toDim : index_type;

  const visited = useMemo(() => {
    const set = new Set<string>();
    set.add(index_type);

    for (let i = 0; i < hops.length - 1; i++) {
      set.add(hops[i].toDim);
    }

    return set;
  }, [index_type, hops]);

  const levelResult = useMemo((): LevelResult | null => {
    if (!selectedSource) return null;

    const startTable =
      !selectedSource.isPrimary && hops.length === 0
        ? {
            id: selectedSource.id,
            given_id: selectedSource.given_id,
            name: selectedSource.name,
            columns: selectedSource.columns,
          }
        : undefined;

    return computeLevel(
      currentDimType,
      tablesByDim,
      dimTypeMap,
      new Set(visited),
      startTable
    );
  }, [
    selectedSource,
    currentDimType,
    tablesByDim,
    dimTypeMap,
    visited,
    hops.length,
  ]);

  const columnGroups = useMemo(() => {
    if (!levelResult) return [];

    const groups = groupColumns(levelResult.columns);

    // Filter hidden columns from each group, then prune empty groups.
    if (hiddenSet.size > 0) {
      return groups
        .map((group) => ({
          ...group,
          columns: group.columns.filter(
            (col) => !isColumnHidden(col.columnName, col)
          ),
        }))
        .filter((group) => group.columns.length > 0);
    }

    return groups;
  }, [levelResult, hiddenSet, isColumnHidden]);

  const supplementalColumns = useMemo(() => {
    if (!supplementalTable) return [];

    const tables = tablesByDim[supplementalTable.dimType] ?? [];
    const table = tables.find((t) => t.id === supplementalTable.tableId);
    if (!table) return [];

    let cols = Object.keys(table.columns).filter((name) => name !== "label");

    if (hiddenSet.size > 0) {
      cols = cols.filter((name) => !isColumnHidden(name, null));
    }

    return cols;
  }, [supplementalTable, tablesByDim, hiddenSet, isColumnHidden]);

  // ── Search filtering ──

  const isSearching = searchQuery.length > 0;
  const searchLower = searchQuery.toLowerCase();

  const filteredColumnGroups = useMemo(() => {
    if (!isSearching) return columnGroups;

    return columnGroups
      .map((group) => ({
        ...group,
        columns: group.columns.filter((col) =>
          col.columnName.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((group) => group.columns.length > 0);
  }, [columnGroups, isSearching, searchLower]);

  // Sort columns within each group: id_column first, disabled last.
  const sortedColumnGroups = useMemo(() => {
    return filteredColumnGroups.map((group) => {
      const idColumn = dimTypeMap[group.dimType]?.id_column ?? null;

      const sorted = [...group.columns].sort((a, b) => {
        const aIsId = a.columnName === idColumn;
        const bIsId = b.columnName === idColumn;
        if (aIsId !== bIsId) return aIsId ? -1 : 1;

        const aDisabled = isColumnDisabled(a.columnName, a);
        const bDisabled = isColumnDisabled(b.columnName, b);
        if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;

        return 0;
      });

      return { ...group, columns: sorted };
    });
  }, [filteredColumnGroups, dimTypeMap, isColumnDisabled]);

  const filteredSupplementalColumns = useMemo(() => {
    if (!isSearching) return supplementalColumns;

    return supplementalColumns.filter((name) =>
      name.toLowerCase().includes(searchLower)
    );
  }, [supplementalColumns, isSearching, searchLower]);

  // ── Focusable items (flat list for keyboard navigation) ──

  const isInSupplementalTable = supplementalTable !== null;
  const depth = hops.length;

  const focusableItems: FocusableItem[] = useMemo(() => {
    const items: FocusableItem[] = [];

    if (isInSupplementalTable) {
      for (const col of filteredSupplementalColumns) {
        items.push({
          columnName: col,
          columnEntry: null,
          disabled: isColumnDisabled(col, null),
        });
      }
    } else {
      for (const group of sortedColumnGroups) {
        for (const col of group.columns) {
          items.push({
            columnName: col.columnName,
            columnEntry: col,
            disabled: isColumnDisabled(col.columnName, col),
          });
        }
      }
    }

    return items;
  }, [
    isInSupplementalTable,
    filteredSupplementalColumns,
    sortedColumnGroups,
    isColumnDisabled,
  ]);

  const selectedColumnName = value?.identifier ?? null;

  // Reset focused index when the list changes.
  // If there's a selected value, focus it instead of defaulting to 0.
  useEffect(() => {
    if (selectedColumnName) {
      const idx = focusableItems.findIndex(
        (item) => item.columnName === selectedColumnName
      );

      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(0);
    }
  }, [focusableItems, selectedColumnName]);

  // Scroll the focused item into view within the dropdown body.
  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      if (!focusedItemRef.current || !dropdownBodyRef.current) return;

      const row = focusedItemRef.current;
      const body = dropdownBodyRef.current;
      const rowTop = row.offsetTop - body.offsetTop;
      const rowBottom = rowTop + row.offsetHeight;
      const scrollTop = body.scrollTop;
      const bodyHeight = body.clientHeight;

      if (rowTop < scrollTop) {
        body.scrollTop = rowTop;
      } else if (rowBottom > scrollTop + bodyHeight) {
        body.scrollTop = rowBottom - bodyHeight;
      }
    });
  }, [isOpen, focusedIndex]);

  // ── Handlers ──

  const resetNavigation = useCallback(() => {
    setHops([]);
    setSupplementalTable(null);
    setSearchQuery("");
    setFocusedIndex(0);
  }, []);

  const refocusSearch = useCallback(() => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const handleDoorClick = useCallback(
    (door: Door) => {
      setSupplementalTable(null);
      setSearchQuery("");
      setHops((prev) => [
        ...prev,
        { throughCol: door.columnName, toDim: door.targetDim },
      ]);
      refocusSearch();
    },
    [refocusSearch]
  );

  const handleBreadcrumbClick = useCallback(
    (bDepth: number) => {
      setSupplementalTable(null);
      setSearchQuery("");
      setHops((prev) => prev.slice(0, bDepth));
      refocusSearch();
    },
    [refocusSearch]
  );

  const handleTableClick = useCallback(
    (st: SupplementalTable) => {
      setSearchQuery("");
      setSupplementalTable({
        tableId: st.table.id,
        tableName: st.table.name,
        dimType: st.dimType,
        dimDisplayName: st.dimDisplayName,
      });
      refocusSearch();
    },
    [refocusSearch]
  );

  const findColumnEntry = useCallback(
    (columnName: string): ColumnEntry | null => {
      if (!levelResult) return null;

      for (const col of levelResult.columns) {
        if (col.columnName === columnName) {
          return col;
        }
      }

      return null;
    },
    [levelResult]
  );

  const handleColumnSelect = useCallback(
    (columnName: string) => {
      if (!selectedSource) return;

      const columnEntry = supplementalTable
        ? null
        : findColumnEntry(columnName);

      const query = buildSliceQuery(
        columnName,
        columnEntry,
        hops,
        supplementalTable,
        selectedSource,
        index_type,
        tablesByDim,
        dimTypeMap
      );

      onChange(query);
      setIsOpen(false);
      resetNavigation();
    },
    [
      supplementalTable,
      findColumnEntry,
      hops,
      selectedSource,
      index_type,
      tablesByDim,
      dimTypeMap,
      onChange,
      resetNavigation,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const itemCount = focusableItems.length;
          if (itemCount === 0) return;
          setFocusedIndex((prev) => {
            let next = (prev + 1) % itemCount;
            let attempts = 0;
            while (focusableItems[next].disabled && attempts < itemCount) {
              next = (next + 1) % itemCount;
              attempts++;
            }
            return next;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const itemCount2 = focusableItems.length;
          if (itemCount2 === 0) return;
          setFocusedIndex((prev) => {
            let next = (prev - 1 + itemCount2) % itemCount2;
            let attempts = 0;
            while (focusableItems[next].disabled && attempts < itemCount2) {
              next = (next - 1 + itemCount2) % itemCount2;
              attempts++;
            }
            return next;
          });
          break;
        }
        case "Enter": {
          e.preventDefault();
          const item = focusableItems[focusedIndex];
          if (item && !item.disabled) {
            handleColumnSelect(item.columnName);
          }
          break;
        }
        case "Tab": {
          // Move focus into the dropdown's interactive elements (doors,
          // breadcrumbs, table buttons) instead of leaving the component.
          // This is especially important when portaled, since the browser's
          // natural tab order won't connect the input to the portal content.
          const dropdown = dropdownElRef.current;
          if (dropdown) {
            const focusable = dropdown.querySelector<HTMLElement>(
              "button, [tabindex]:not([tabindex='-1'])"
            );
            if (focusable) {
              e.preventDefault();
              focusable.focus();
            }
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setIsOpen(false);
          break;
        }
        default:
          break;
      }
    },
    [focusableItems, focusedIndex, handleColumnSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      resetNavigation();
    },
    [onChange, resetNavigation]
  );

  const handleTriggerClick = useCallback(() => {
    if (isLoading) return;

    if (!isOpen) {
      if (value) {
        try {
          const nav = deriveNavStateFromValue(
            value,
            index_type,
            tablesByDim,
            dimTypeMap
          );

          setHops(nav.hops);
          setSupplementalTable(nav.supplementalTable);
        } catch {
          resetNavigation();
        }
      } else {
        resetNavigation();
      }

      setSearchQuery("");
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [
    isLoading,
    isOpen,
    value,
    index_type,
    tablesByDim,
    dimTypeMap,
    resetNavigation,
  ]);

  const handleCaretClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isOpen) {
        setIsOpen(false);
      } else {
        handleTriggerClick();
      }
    },
    [isOpen, handleTriggerClick]
  );

  // ── Display ──

  const displayLabel = useMemo(() => {
    if (!value) return null;

    try {
      const nav = deriveNavStateFromValue(
        value,
        index_type,
        tablesByDim,
        dimTypeMap
      );

      return displayLabelFromNavState(
        value.identifier,
        nav.hops,
        nav.supplementalTable?.tableName ?? null
      );
    } catch {
      return value.identifier;
    }
  }, [value, index_type, tablesByDim, dimTypeMap]);

  const indexTypeDisplayName =
    dimTypeMap[index_type]?.display_name ?? index_type;

  const tableDisplayName = useCallback(
    (tableId: string, tableName: string, dimType: string): string => {
      const metaId = dimTypeMap[dimType]?.metadata_dataset_id;
      return tableId === metaId ? "Primary Annotations" : tableName;
    },
    [dimTypeMap]
  );

  const viaHint = useCallback((autoPath: { throughCol: string }[]):
    | string
    | null => {
    if (autoPath.length === 0) return null;
    return autoPath[0].throughCol;
  }, []);

  const visibleSupplementalTables = useMemo(() => {
    if (depth === 0 || isInSupplementalTable || !levelResult) return [];
    return levelResult.supplementalTables;
  }, [depth, isInSupplementalTable, levelResult]);

  // ── Render helpers ──

  // Running counter for mapping rendered rows to focusableItems indices.
  let rowIndex = 0;

  const renderColumnRow = (
    columnName: string,
    columnEntry: ColumnEntry | null,
    via: string | null
  ) => {
    const disabled = isColumnDisabled(columnName, columnEntry);
    const currentIndex = rowIndex++;
    const isFocused = currentIndex === focusedIndex;
    const isSelected = columnName === selectedColumnName;

    return (
      <div
        key={columnName}
        ref={isFocused ? focusedItemRef : undefined}
        className={styles.columnRow}
        data-selected={isSelected ? "true" : undefined}
        data-focused={isFocused ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        onClick={disabled ? undefined : () => handleColumnSelect(columnName)}
        onMouseEnter={() => setFocusedIndex(currentIndex)}
      >
        <span className={styles.columnName}>{columnName}</span>
        {via && <span className={styles.columnVia}>via {via}</span>}
      </div>
    );
  };

  // ── Dropdown content ──

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownElRef}
      className={styles.dropdown}
      data-portaled={menuPortalTarget ? "" : undefined}
      data-placement={placement}
      style={{ maxHeight }}
    >
      {/* Breadcrumb trail */}
      {depth > 0 && (
        <div className={styles.breadcrumbs}>
          <button
            className={styles.breadcrumbNode}
            type="button"
            onClick={() => handleBreadcrumbClick(0)}
          >
            {indexTypeDisplayName}
          </button>
          {hops.map((hop, i) => {
            const isCurrent = i === hops.length - 1 && !isInSupplementalTable;

            return (
              <span key={hop.throughCol} className={styles.breadcrumbSep}>
                <ChevronRight size={10} />
                {isCurrent ? (
                  <span className={styles.breadcrumbNode} data-current="true">
                    {hop.throughCol}
                  </span>
                ) : (
                  <button
                    className={styles.breadcrumbNode}
                    type="button"
                    onClick={() => handleBreadcrumbClick(i + 1)}
                  >
                    {hop.throughCol}
                  </button>
                )}
              </span>
            );
          })}
          {isInSupplementalTable && (
            <span className={styles.breadcrumbSep}>
              <ChevronRight size={10} />
              <span className={styles.breadcrumbNode} data-current="true">
                {supplementalTable!.tableName}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Scrollable body */}
      <div className={styles.dropdownBody} ref={dropdownBodyRef}>
        {/* Supplemental table view */}
        {isInSupplementalTable && (
          <div className={styles.propertiesList}>
            <div className={styles.columnGroupHeader}>
              <DimBadge
                dimType={supplementalTable!.dimType}
                displayName={supplementalTable!.dimDisplayName}
              />
              <TableBadge name={supplementalTable!.tableName} />
              <span className={styles.columnCount}>
                {filteredSupplementalColumns.length}
              </span>
            </div>
            {filteredSupplementalColumns.map((col) =>
              renderColumnRow(col, null, null)
            )}
          </div>
        )}

        {/* Normal level view */}
        {!isInSupplementalTable && (
          <>
            {/* Doors */}
            {!isSearching && levelResult && levelResult.doors.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Navigate through</div>
                <div className={styles.doorList}>
                  {levelResult.doors.map((d) => (
                    <button
                      key={d.columnName}
                      className={styles.doorBtn}
                      style={dimColorStyle(d.targetDim)}
                      type="button"
                      onClick={() => handleDoorClick(d)}
                    >
                      <span className={styles.doorBody}>
                        <span className={styles.doorColName}>
                          {d.columnName}
                        </span>
                        <span className={styles.doorTarget}>
                          → {d.targetDimDisplayName}
                        </span>
                      </span>
                      <span className={styles.doorChevron}>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Continue to table */}
            {!isSearching && visibleSupplementalTables.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Continue to table</div>
                <div className={styles.tableList}>
                  {visibleSupplementalTables.map((st) => (
                    <button
                      key={st.table.id}
                      className={styles.tableBtn}
                      type="button"
                      onClick={() => handleTableClick(st)}
                    >
                      <DimBadge
                        dimType={st.dimType}
                        displayName={st.dimDisplayName}
                      />
                      <span className={styles.tableName}>{st.table.name}</span>
                      <span className={styles.countHint}>{st.columnCount}</span>
                      <span className={styles.doorChevron}>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Properties */}
            {sortedColumnGroups.length > 0 && (
              <div className={styles.propertiesList}>
                {sortedColumnGroups.map((group) => (
                  <div key={`${group.dimType}::${group.tableId}`}>
                    <div className={styles.columnGroupHeader}>
                      <DimBadge
                        dimType={group.dimType}
                        displayName={group.dimDisplayName}
                      />
                      <TableBadge
                        name={tableDisplayName(
                          group.tableId,
                          group.tableName,
                          group.dimType
                        )}
                      />
                      <span className={styles.columnCount}>
                        {group.columns.length}
                      </span>
                    </div>
                    {group.columns.map((col) =>
                      renderColumnRow(
                        col.columnName,
                        col,
                        viaHint(col.autoPath)
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* No results */}
        {isSearching &&
          sortedColumnGroups.length === 0 &&
          filteredSupplementalColumns.length === 0 && (
            <div className={styles.noResults}>No options</div>
          )}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.combobox} ref={containerRef}>
      <div className={styles.selectorLabel}>
        <label>Annotation</label>
      </div>
      <ConditionalTooltip
        showTooltip={value && !isOpen && isTruncated}
        content={<WordBreaker text={displayLabel} />}
      >
        <div
          className={styles.comboboxTrigger}
          data-open={isOpen ? "true" : undefined}
          onClick={handleTriggerClick}
          ref={triggerRef}
          tabIndex={isOpen ? undefined : 0}
          onKeyDown={
            isOpen
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTriggerClick();
                  }
                }
          }
        >
          {isLoading ? (
            <>
              <span className={styles.comboboxPlaceholder}>Loading…</span>
              <span className={styles.comboboxSpinner} />
            </>
          ) : isOpen ? (
            <>
              {value && displayLabel && !searchQuery && (
                <span className={styles.comboboxGhostValue}>
                  {displayLabel}
                </span>
              )}
              <input
                ref={searchInputRef}
                className={styles.comboboxSearchInput}
                placeholder={value ? undefined : "Choose annotation…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && searchQuery === "" && value) {
                    e.preventDefault();
                    onChange(null);
                    resetNavigation();
                    return;
                  }

                  handleKeyDown(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              {value && (
                <span
                  className={styles.comboboxClear}
                  role="button"
                  tabIndex={-1}
                  onClick={handleClear}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <RemoveIcon />
                </span>
              )}
            </>
          ) : value && displayLabel ? (
            <>
              <span className={styles.comboboxValue}>
                <span ref={displayLabelRef}>{displayLabel}</span>
              </span>
              <span
                className={styles.comboboxClear}
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <RemoveIcon />
              </span>
            </>
          ) : (
            <span className={styles.comboboxPlaceholder}>
              Choose annotation…
            </span>
          )}
          <span
            className={styles.comboboxCaret}
            onClick={handleCaretClick}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CaretDown />
          </span>
        </div>
      </ConditionalTooltip>
      {isOpen &&
        (menuPortalTarget ? (
          <MenuPortal
            controlElement={triggerRef.current}
            appendTo={menuPortalTarget}
            isOpen={isOpen}
            minWidth={550}
            placement={placement}
          >
            {dropdownContent}
          </MenuPortal>
        ) : (
          dropdownContent
        ))}
    </div>
  );
}
