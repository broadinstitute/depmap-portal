import React from "react";

import RelatedCompoundsTile from "../components/tiles/RelatedCompoundsTile";

export default {
  title: "Components/Compounds/RelatedCompooundsTile",
  component: RelatedCompoundsTile,
};

export const RelatedCompoundsTileStory = () => {
  return <RelatedCompoundsTile datasetName={"OncRef Dataset"} />;
};
