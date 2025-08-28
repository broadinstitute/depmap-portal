import React from "react";

import { TopDatasetDependencies } from "../tiles/CorrelatedDependenciesTile/TopDatasetDependencies";

export default {
  title: "Components/Compounds/TopDatasetCorrelations",
  component: TopDatasetDependencies,
};

export const TopDatasetCorrelationsStory = () => {
  return <TopDatasetDependencies datasetName="CRISPR" />;
};
