import React from "react";

import RelatedCompoundsTile from "../tiles/RelatedCompoundsTile/RelatedCompoundsTile";

export default {
  title: "Components/Compounds/RelatedCompooundsTile",
  component: RelatedCompoundsTile,
};

export const RelatedCompoundsTileStory = () => {
  return <RelatedCompoundsTile datasetName={"OncRef Dataset"} />;
};
