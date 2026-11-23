import React from "react";
import { ALL_TAGS_OPTION } from "./useVersionFiles";
import { TagTab } from "./useFilteredReleaseFiles";
import styles from "./VersionFileView.scss";

interface DataTagsProps {
  totalFilesCount: number;
  tabs: TagTab[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}

const DataTags: React.FC<DataTagsProps> = ({
  totalFilesCount,
  tabs,
  selectedTag,
  onSelectTag,
}) => {
  if (tabs.length === 0) return null;

  const allTabs = [
    {
      value: ALL_TAGS_OPTION,
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
      className={styles.tagTabsBar}
    >
      {allTabs.map((tab) => {
        const isActive = selectedTag === tab.value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.tagTab} ${
              isActive ? styles.tagTabActive : ""
            }`}
            onClick={() => onSelectTag(tab.value)}
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
