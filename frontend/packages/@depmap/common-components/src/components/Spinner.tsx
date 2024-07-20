/* eslint-disable */
import React, { CSSProperties } from "react";
import cx from "classnames";
import styles from "../styles/Spinner.scss";

interface SpinnerProps {
  left?: string;
  position?: CSSProperties["position"];
  className?: string;
}

export class Spinner extends React.Component<SpinnerProps> {
  render() {
    let { left } = this.props;
    if (!left) {
      left = "65vw";
    }

    let { position } = this.props;
    if (!position) {
      position = "absolute";
    }

    const { className } = this.props;

    return (
      /// / percentage of viewport width
      <div
        className={cx(styles.spinner, className)}
        style={{ position, zIndex: 1, left }}
      >
        <div />
        <div className={styles.rect2} />
        <div className={styles.rect3} />
        <div className={styles.rect4} />
        <div className={styles.rect5} />
      </div>
    );
  }
}
