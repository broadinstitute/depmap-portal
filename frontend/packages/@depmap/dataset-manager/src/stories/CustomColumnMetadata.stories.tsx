import * as React from "react";
import { useState } from "react";
import ReactDOM from "react-dom";
import { ColumnMetadata } from "./CustomColumnMetadata";

export default {
  title: "Components/ColumnMetadata",
  component: ColumnMetadata,
};

export function TestControlledFormStory() {
  return <ColumnMetadata />;
}
