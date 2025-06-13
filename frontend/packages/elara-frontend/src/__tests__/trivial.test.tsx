import * as React from "react";
import { useEffect, useState } from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";

function ComponentThatUsesBreadboxApi() {
  const [breadboxUser, setBreadboxUser] = useState("");

  useEffect(() => {
    breadboxAPI.getBreadboxUser().then((user) => {
      setBreadboxUser(user);
    });
  }, []);

  return <div>{breadboxUser}</div>;
}

test("a trivial test", async () => {
  breadboxAPI.getBreadboxUser = jest
    .fn<ReturnType<typeof breadboxAPI.getBreadboxUser>, []>()
    .mockResolvedValue("dev@sample.com");

  const { getByRole, getByTestId } = render(
    <main>
      <h1 data-testid="foo">bar</h1>
      <ComponentThatUsesBreadboxApi />
    </main>
  );

  const main = getByRole("main");
  expect(main).toBeVisible();

  const h1 = getByTestId("foo");
  expect(h1).toHaveTextContent("bar");

  await waitFor(() => {
    return expect(screen.getByText("dev@sample.com")).toBeInTheDocument();
  });
});
