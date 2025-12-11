import React from "react";
import LargeTermGroup from "./TabTypes/LargeTermGroup";
import SmallTermGroup from "./TabTypes/SmallTermGroup";

const TERM_THRESHOLD = 10;

interface TermGroupTabsProps {
  termGroup: string;
  termsWithinSelectedGroup: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const TermGroupTabs: React.FC<TermGroupTabsProps> = ({
  termGroup,
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  const isLargeTermGroup = termsWithinSelectedGroup.length > TERM_THRESHOLD;

  if (isLargeTermGroup) {
    return (
      <LargeTermGroup
        termGroup={termGroup}
        termsWithinSelectedGroup={termsWithinSelectedGroup}
        termToMatchingGenesMap={termToMatchingGenesMap}
        useAllGenes={useAllGenes}
      />
    );
  }
  // Mode for <= 10 Terms
  return (
    <SmallTermGroup
      termsWithinSelectedGroup={termsWithinSelectedGroup}
      termToMatchingGenesMap={termToMatchingGenesMap}
      useAllGenes={useAllGenes}
    />
  );
};

export default TermGroupTabs;
