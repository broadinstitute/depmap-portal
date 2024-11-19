import React from "react";
import { errorHandler } from "@depmap/globals";
import styles from "../../styles/DimensionSelect.scss";

type Props = {
  reset: () => void;
  children: React.ReactNode;
};

type State = {
  errorInfo: React.ErrorInfo | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    window.console.error(error);

    if (error.stack) {
      errorHandler.report(error.stack);
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.errorInfo) {
      return (
        <div className={styles.ErrorBoundary}>
          <button
            type="button"
            onClick={() => {
              this.props.reset();
              this.setState({ errorInfo: null });
            }}
          >
            <span
              className="glyphicon glyphicon-exclamation-sign"
              aria-hidden="true"
            />
            <span>Unable to load</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function wrapWithErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return (props: P) => (
    <ErrorBoundary
      reset={() => {
        (props as { onChange: (o: object) => void }).onChange({});
      }}
    >
      <Component {...props} />
    </ErrorBoundary>
  );
}
