import * as React from "react";
import { useEffect, useState } from "react";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";

export function ComponentThatUsesBreadboxApi() {
  const [breadboxUser, setBreadboxUser] = useState("");

  useEffect(() => {
    breadboxAPI.getBreadboxUser().then((user) => {
      setBreadboxUser(user);
    });
  }, []);

  return <div>{breadboxUser}</div>;
}

export function ComponentThatUsesPortalApi() {
  const [feedbackUrl, setFeedbackUrl] = useState("");

  useEffect(() => {
    legacyPortalAPI.getFeedbackUrl().then((url) => {
      setFeedbackUrl(url);
    });
  }, []);

  return <div>{feedbackUrl}</div>;
}
