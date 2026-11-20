import React from "react";
import { ALL_DATATYPES_OPTION } from "./useVersionFiles";
import { DatatypeTab } from "./useFilteredReleaseFiles";
import styles from "./VersionFileView.scss";

interface DataTagsProps {
  totalFilesCount: number;
  tabs: DatatypeTab[];
  selectedDatatype: string;
  onSelectDatatype: (datatype: string) => void;
}

const DataTags: React.FC<DataTagsProps> = ({
  totalFilesCount,
  tabs,
  selectedDatatype,
  onSelectDatatype,
}) => {
  if (tabs.length === 0) return null;

  const allTabs = [
    {
      value: ALL_DATATYPES_OPTION,
      label: "All Files",
      count: totalFilesCount,
      showIcon: false,
    },
    ...tabs.map((tab) => ({ ...tab, showIcon: true })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Files by Data Tag"
      className={styles.datatypeTabsBar}
    >
      {allTabs.map((tab) => {
        const isActive = selectedDatatype === tab.value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.datatypeTab} ${
              isActive ? styles.datatypeTabActive : ""
            }`}
            onClick={() => onSelectDatatype(tab.value)}
          >
            {tab.showIcon && (
              <span
                className={`glyphicon glyphicon-tag ${styles.tagIcon}`}
                aria-hidden="true"
              />
            )}
            <span>{tab.label}</span>
            <span className={styles.tabCountBadge}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DataTags;
