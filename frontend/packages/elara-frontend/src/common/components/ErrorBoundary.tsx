import * as React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  componentDidUpdate(_: Props, prevState: State) {
    // Allow recovering from errors in development mode.
    if (
      process.env.NODE_ENV === "development" &&
      prevState.error !== undefined
    ) {
      this.setState({ error: undefined, errorInfo: undefined });
    }
  }

  render() {
    if (this.state.errorInfo) {
      return (
        <div style={{ textAlign: "center" }}>
          <h1>An internal error occurred</h1>
          <p>
            Sorry, something went wrong on our system. We have been notified and
            will be fixing it.
          </p>
          <p>
            If you would like to help fix this error, you can help by{" "}
            <a
              target="_blank"
              rel="noreferrer noopener"
              href="mailto:depmap@broadinstitute.org"
            >
              telling us what happened before this error
            </a>
            .
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
