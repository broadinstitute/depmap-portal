import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import * as React from "react";

test("a trivial test", () => {
  const { getByRole, getByTestId } = render(
    <main>
      <h1 data-testid="foo">bar</h1>
    </main>
  );

  const main = getByRole("main");
  expect(main).toBeVisible();

  const h1 = getByTestId("foo");
  expect(h1).toHaveTextContent("bar");
});
