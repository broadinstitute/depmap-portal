import * as React from "react";
import { NetworkOverrepresentation } from "src/celfie/components/NetworkOverrepresentation";
import { expressionData } from "src/celfie/stories/expressionData";

export default {
  title: "Components/Celfie/NetworkOverrepresentation",
  component: NetworkOverrepresentation,
};

const dataOptions = {
  marker: {
    color: "blue",
    size: 10,
  },
};

const layout = {
  height: 500,
};

const onClick = (buttonInput: any) => {
  console.log(buttonInput);
};
export const NetworkOverrepresentationStory = () => {
  return (
    <NetworkOverrepresentation
      graphData={expressionData}
      isLoading={false}
      dataOptions={dataOptions}
      graphLayout={layout}
      onButtonClickLongTable={onClick}
    />
  );
};
