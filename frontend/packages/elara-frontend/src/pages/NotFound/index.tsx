import React from "react";

import styles from "src/pages/NotFound/styles.scss";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1>404</h1>
      <p>Sorry, that page doesn’t exist.</p>
      <p>
        Want to <a href="/">go home</a> instead?
      </p>
    </div>
  );
}
