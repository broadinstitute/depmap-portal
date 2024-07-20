import React from "react";

import StyledMeter from "src/common/components/StyledMeter";

export default {
  title: "Components/Common/StyledMeter",
  component: StyledMeter,
};

export const Default = () => {
  return <StyledMeter value={0.5} />;
};

export const WithAdditionalStyles = () => {
  return (
    <StyledMeter
      value={0.5}
      style={{ width: 100, backgroundColor: "pink", barColor: "purple" }}
    />
  );
};
export const WithLabel = () => {
  return <StyledMeter value={0.5} showLabel style={{ labelColor: "white" }} />;
};
