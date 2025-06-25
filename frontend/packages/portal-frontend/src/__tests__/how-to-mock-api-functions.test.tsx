import * as React from "react";
import { legacyPortalAPI, breadboxAPI } from "@depmap/api";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import {
  ComponentThatUsesBreadboxApi,
  ComponentThatUsesPortalApi,
} from "./example-components";

test("How to mock a Portal API response", async () => {
  const feedbackUrl = "https://forum.depmap.org/";

  // Try commenting this out. You should get a helpful
  // error message reminding you to mock the API response.
  legacyPortalAPI.getFeedbackUrl = jest
    .fn<ReturnType<typeof legacyPortalAPI.getFeedbackUrl>, []>()
    .mockResolvedValue(feedbackUrl);

  render(<ComponentThatUsesPortalApi />);

  await waitFor(() => {
    return expect(screen.getByText(feedbackUrl)).toBeInTheDocument();
  });
});

test("How to mock a Breadbox API response", async () => {
  const user = "dev@sample.com";

  // Try commenting this out. You should get a helpful
  // error message reminding you to mock the API response.
  breadboxAPI.getBreadboxUser = jest
    .fn<ReturnType<typeof breadboxAPI.getBreadboxUser>, []>()
    .mockResolvedValue(user);

  render(<ComponentThatUsesBreadboxApi />);

  await waitFor(() => {
    return expect(screen.getByText(user)).toBeInTheDocument();
  });
});
