import React from "react";

function Component() {
  return <div>A trivial story for testing</div>;
}

export default {
  title: "Trivial story",
  component: Component,
};

export const Test = () => {
  return <Component />;
};
