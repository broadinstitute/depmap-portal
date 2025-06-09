import React from "react";

import { TopDatasetCorrelations } from "../components/tiles/TopDatasetCorrelations";

export default {
  title: "Components/Compounds/TopDatasetCorrelations",
  component: TopDatasetCorrelations,
};

export const TopDatasetCorrelationsStory = () => {
  return <TopDatasetCorrelations datasetName="CRISPR" />;
};
