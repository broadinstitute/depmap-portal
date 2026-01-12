import React, { useState, useEffect, useRef } from "react";
import { ProgressBar } from "react-bootstrap";
import { CeleryTask, CeleryTaskState } from "@depmap/compute";
import { ErrorTypeError } from "@depmap/types";

interface Props {
  getTaskStatus: () => Promise<CeleryTask>;
  onSuccess: (result: CeleryTask) => void;
  onFailure?: (result?: CeleryTask) => void;
  onCancel?: () => void;
  getDebugInfo?: () => React.ReactNode;
  pollInterval?: number; // in ms
}

const getBsStyleFromTaskState = (state: CeleryTaskState) => {
  return {
    STARTED: "info",
    PENDING: "info",
    RECEIVED: "info",
    PROGRESS: "info",
    SUCCESS: "success",
    IGNORED: "warning",
    RETRY: "warning",
    REJECTED: "danger",
    FAILURE: "danger",
    REVOKED: "danger",
  }[state];
};

const flexStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

function ProgressTracker({
  getTaskStatus,
  onSuccess,
  onFailure = () => {},
  onCancel = () => {},
  getDebugInfo = () => null,
  pollInterval = 1000,
}: Props) {
  const [task, setTask] = useState<CeleryTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        onCancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const pollStatus = async () => {
      try {
        const response = await getTaskStatus();
        setTask(response);

        if (response.state === "SUCCESS") {
          cleanup();
          onSuccess(response);
        } else if (response.state === "FAILURE") {
          cleanup();
          onFailure(response);
          setError(response.message);
        } else {
          // Schedule next poll
          const delay = response.nextPollDelay ?? pollInterval;
          timeoutRef.current = setTimeout(pollStatus, delay);
        }
      } catch (err) {
        const errorMessage = [
          "Unexpected error. If you get this error consistently, ",
          "please contact us with a screenshot and the actions that ",
          "lead to this error.",
        ].join("");

        setError(errorMessage);

        if (err instanceof ErrorTypeError) {
          setErrorDetails(err.message);
        }

        cleanup();
        onFailure();
      }
    };

    pollStatus();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval]);

  if (error) {
    return (
      <div style={flexStyle}>
        <div>Failed</div>
        <ProgressBar bsStyle="danger" now={100} />
        <div style={{ color: "#d9534f" }}>{error}</div>
        {errorDetails || getDebugInfo ? (
          <details>
            <div>{errorDetails}</div>
            <div>{getDebugInfo()}</div>
          </details>
        ) : null}
      </div>
    );
  }

  if (!task) {
    return (
      <div style={flexStyle}>
        <div>Submitting…</div>
        <ProgressBar active striped now={0} />
      </div>
    );
  }

  const isActive = task.state !== "SUCCESS" && task.state !== "FAILURE";
  const now = task.state === "SUCCESS" ? 100 : task.percentComplete ?? 0;
  let message = task.message;

  if (task.state === "PENDING") {
    message = "Pending…";
  }

  if (task.state === "SUCCESS") {
    message = "Complete!";
  }

  return (
    <div style={flexStyle}>
      <div>{message}</div>
      <ProgressBar
        now={now}
        label={now >= 4 && `${Math.round(now)}%`}
        active={isActive}
        striped={isActive}
        bsStyle={getBsStyleFromTaskState(task.state)}
      />
    </div>
  );
}

export default ProgressTracker;
