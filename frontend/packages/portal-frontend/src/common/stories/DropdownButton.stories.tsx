import * as React from "react";
import { MenuItem } from "react-bootstrap";

import DropdownButton from "src/common/components/DropdownButton";
import { titleCase } from "@depmap/utils";

const { useState } = React;

export default {
  title: "Components/Common/DropdownButton",
  component: DropdownButton,
};

export const Default = () => {
  const [selectedKey, setSelectedKey] = useState("blue");
  return (
    <DropdownButton
      id="default"
      selectedEventKey={selectedKey}
      onSelect={(eventKey) => setSelectedKey(eventKey)}
    >
      {["red", "blue", "green"].map((v) => (
        <MenuItem eventKey={v} key={v}>
          {titleCase(v)}
        </MenuItem>
      ))}
    </DropdownButton>
  );
};

export const WithDivider = () => {
  const [selectedKey, setSelectedKey] = useState("blue");
  return (
    <DropdownButton
      id="divider"
      selectedEventKey={selectedKey}
      onSelect={(eventKey) => setSelectedKey(eventKey)}
    >
      {["red", "blue", "divider", "green"].map((v) =>
        v === "divider" ? (
          <MenuItem divider />
        ) : (
          <MenuItem eventKey={v} key={v}>
            {titleCase(v)}
          </MenuItem>
        )
      )}
    </DropdownButton>
  );
};

export const WithDescription = () => {
  const [selectedKey, setSelectedKey] = useState("blue");
  return (
    <DropdownButton
      id="description"
      selectedEventKey={selectedKey}
      onSelect={(eventKey) => setSelectedKey(eventKey)}
      description={"Choose color: "}
    >
      {["red", "blue", "divider", "green"].map((v) => (
        <MenuItem eventKey={v} key={v}>
          {titleCase(v)}
        </MenuItem>
      ))}
    </DropdownButton>
  );
};
