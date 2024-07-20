/* eslint-disable */
import * as React from "react";
import cx from "classnames";
import { CeleryTaskState, CeleryTask } from "@depmap/compute";
import styles from "../styles/ProgressTracker.scss";

function later(delay: number): Promise<any> {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

interface ProgressTrackerProps {
  startSpan?: (label: string) => ActiveSpan; // may be null
  submissionResponse: Promise<CeleryTask>; // may be null
  onSuccess: (result: CeleryTask, _?: unknown) => void;
  onFailure: (result: CeleryTask) => void;
  getTaskStatus: (responseId: string) => Promise<CeleryTask>;
  // allow us to override the next poll delay
  nextPollDelay?: number | null;
}

interface ProgressTrackerState {
  lastResponse?: CeleryTask;
}

interface ActiveSpan {
  end: () => void;
}

// this mock response is just so that the render can render something, so that users get feedback once the click happens that they did something
// used when submission has happened, but we have not resolved the promise yet
const mockSummitedResponse: CeleryTask = {
  id: "", // this is okay, only because there is no attempt to checkStatus. that only happens after we get the real response back, and attempt to resolve
  state: "PENDING",
  message: "Submitting",
  nextPollDelay: undefined,
  percentComplete: undefined,
  result: null,
};

export default class ProgressTracker extends React.Component<
  ProgressTrackerProps,
  ProgressTrackerState
> {
  span?: ActiveSpan;

  constructor(props: ProgressTrackerProps) {
    super(props);
    this.state = {
      lastResponse:
        props.submissionResponse == undefined
          ? undefined
          : mockSummitedResponse, // if promise is available, initialize with the mock response until we resolve it (which will be done in componentDidMount)
    };
  }

  componentDidMount = () => {
    if (this.props.startSpan) {
      this.span = this.props.startSpan("ProgressTracker");
    }
    this.props.submissionResponse.then(this.resolve, this.reject);
  };

  componentDidUpdate(prevProps: ProgressTrackerProps) {
    // handle resubmission after the component has been mounted
    if (this.props.submissionResponse != prevProps.submissionResponse) {
      if (this.props.submissionResponse != null) {
        // show the user something for immediate feedback, until the response is resolved
        this.setState({
          lastResponse: mockSummitedResponse,
        });
        this.props.submissionResponse.then(this.resolve, this.reject);
      }
    }
  }

  /**
    About resolve and reject functions

    For normal, expected user input errors, the back end returns 200 with state failure
    For unexpected failure modes, the back end returns 500. This is so that the error gets sent to stackdriver
    For these unexpected errors, we catch the 500, and mimic the response from a failed-gracefully-with-200

    whether we return 200 (resolve) or 500 (reject), call updateStateFromResponse
    just that in the 500 case, we need to mimic a fake response with a generic error message
  */

  resolve = (response: CeleryTask) => {
    this.updateStateFromResponse(response);
    this.checkStatus(response);
  };

  reject = (response: any) => {
    this.updateStateFromResponse({
      id: "",
      state: "FAILURE",
      nextPollDelay: 0,
      percentComplete: undefined,
      message:
        "Unexpected error. If you get this error consistently, please contact us with a screenshot and the actions that lead to this error.",
      result: null,
    });
    this.props.onFailure(response);
  };

  checkStatus = (response: CeleryTask) => {
    if (response.state == "SUCCESS") {
      if (this.span) {
        this.span.end();
        this.span = undefined;
      }
      this.props.onSuccess(response);
    } else if (response.state == "FAILURE") {
      if (this.span) {
        this.span.end();
        this.span = undefined;
      }
      this.props.onFailure(response);
    } else {
      let nextPollDelay = response.nextPollDelay;
      if (this.props.nextPollDelay) {
        nextPollDelay = this.props.nextPollDelay;
      }
      return later(nextPollDelay || 0)
        .then(() => {
          return this.props.getTaskStatus(response.id);
        })
        .then(this.resolve, this.reject);
    }
  };

  updateStateFromResponse = (response: CeleryTask) => {
    const lastResponse = response;
    if (response.state == "PENDING") {
      lastResponse.message = "PENDING";
    }
    this.setState({
      lastResponse,
    });
  };

  renderLoadingAnimation = (runStatus?: CeleryTaskState) => {
    const className = !runStatus
      ? null
      : runStatus == "PROGRESS"
      ? "running"
      : runStatus.toLowerCase();

    return (
      <div
        className={cx(
          styles.loadingAnimationCommon,
          className && styles[className]
        )}
      />
    );
  };

  render() {
    let percentCompleteString = "";
    let messageClass = "";
    let loadingAnimation = null;
    let message = "";
    if (this.state.lastResponse) {
      if (
        this.state.lastResponse.percentComplete &&
        this.state.lastResponse.state == "PROGRESS"
      ) {
        percentCompleteString = `${Math.round(
          this.state.lastResponse.percentComplete
        )}%: `;
      }
      messageClass =
        this.state.lastResponse.state == "PENDING" ? "loadingEllipsis" : "";
      loadingAnimation = this.renderLoadingAnimation(
        this.state.lastResponse.state
      );
      message = this.state.lastResponse.message;
    }

    const id: string = this.state.lastResponse
      ? this.state.lastResponse.id
      : "";

    return (
      <div
        id="progressTracker"
        key={id}
        style={{ display: "flex", flexDirection: "row", alignItems: "center" }}
      >
        {loadingAnimation}
        <div className={styles.percentComplete}>{percentCompleteString}</div>
        <div className={styles[messageClass]}>{message}</div>
      </div>
    );
  }
}
