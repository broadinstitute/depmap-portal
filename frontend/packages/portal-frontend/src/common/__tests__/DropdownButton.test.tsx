import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
// import "jest-styled-components";

import { MenuItem } from "react-bootstrap";
import DropdownButton from "src/common/components/DropdownButton";
import { titleCase } from "@depmap/utils";

const { useState } = React;

const Wrapper = () => {
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

test("has the label of the option with matching selectedEventKey", () => {
  // Arrange
  const { container } = render(<Wrapper />);

  // Act

  // Assert
  expect(container.firstChild).not.toHaveClass("open");
  expect(container.firstChild).toHaveTextContent("Blue");
});

test("opens dropdown when clicked", () => {
  // Arrange
  const { container } = render(<Wrapper />);

  // Act
  fireEvent.click(container.querySelector(".dropdown-button-label") as Element);

  // Assert
  expect(container.firstChild).toHaveClass("open");
});

test("changes label when dropdown item is selected", () => {
  // Arrange
  const { container, getByText } = render(<Wrapper />);

  // Act
  // open dropdown
  fireEvent.click(container.querySelector(".dropdown-button-label") as Element);
  // click dropdown option
  fireEvent.click(getByText("Green"));

  // Assert
  // dropdown menu should close
  expect(container.firstChild).not.toHaveClass("open");
  expect(container.querySelector(".dropdown-button-label")).toHaveTextContent(
    "Green"
  );
});
