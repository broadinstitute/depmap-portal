import * as React from "react";
import { Button } from "react-bootstrap";

import { Tooltip } from "../components/Tooltip";

export default {
  title: "Components/Common/Tooltip",
  component: Tooltip,
};

export const Minimal = () => {
  return (
    <Tooltip id={"storybook-tooltip"} content={"Your content here"}>
      <Button>Hover me</Button>
    </Tooltip>
  );
};

export const Styled = () => {
  return (
    <Tooltip
      id={"storybook-tooltip"}
      content={"Your content here"}
      placement={"top"}
    >
      <Button>Hover me</Button>
    </Tooltip>
  );
};

// Add spacing so that we can see the hovers. (Story: any) is the best typing I can come up with from looking at the docs and source code
Styled.decorators = [
  (Story: any) => (
    <div style={{ margin: "30px" }}>
      <Story />
    </div>
  ),
];

// todo: implement and add styled version
