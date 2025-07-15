import React, { ReactNode } from "react";
import cx from "classnames";
import styles from "../styles/ExternalLink.scss";

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

function ExternalLink({ href, children, className, ...rest }: Props) {
  return (
    <a
      className={cx(styles.ExternalLink, className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      {...rest}
    >
      {children}
      <span
        className={cx(
          "glyphicon",
          "glyphicon-new-window",
          styles.externalLinkIcon
        )}
      />
    </a>
  );
}

export default ExternalLink;
