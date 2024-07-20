import React from "react";

import CorrelationMeter from "src/predictability/components/CorrelationMeter";

export default {
  title: "Components/Predictability/CorrelationMeter",
  component: CorrelationMeter,
};

export const Positive = () => {
  return <CorrelationMeter correlation={0.25} />;
};

export const Negative = () => {
  return <CorrelationMeter correlation={-0.25} />;
};
