import React from "react";
import { DependencyMeter } from "../tiles/CorrelatedDependenciesTile/DependencyMeter";

export default {
  title: "Components/Compounds/DependencyMeter",
  component: DependencyMeter,
};

export const DependencyMeterStory = () => {
  return <DependencyMeter correlation={0.6} />;
};
