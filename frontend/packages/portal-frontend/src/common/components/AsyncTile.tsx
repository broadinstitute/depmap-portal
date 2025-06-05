import React, { useEffect, useRef, useState } from "react";
import cx from "classnames";
import uniqueId from "lodash.uniqueid";
import { fetchUrlPrefix } from "src/common/utilities/context";
import styles from "src/common/styles/async_tile.module.scss";

interface Props {
  url: string;
  id?: string;
  onLoad?: (html: string, node?: HTMLDivElement) => void;
  transformHtml?: (html: string) => string;
  renderEmptyResponse?: () => React.ReactElement | null;
}

const htmlCache: Record<string, string> = {};
const callbackCache: Record<string, (containerId: string) => void> = {};

function LoadingTile() {
  return (
    <div className={cx(styles.LoadingTile, "loading-tile")}>Loading...</div>
  );
}

function ErrorTile() {
  return <div className={styles.ErrorTile}>Sorry, an error occurred.</div>;
}

const AsyncTile = ({
  url,
  id = undefined,
  onLoad = () => {},
  transformHtml = (html: string) => html,
  // render null instead of of a containing <div>. That makes it
  // straightforward to detect and hide empty columns with CSS alone.
  renderEmptyResponse = (): null => null,
}: Props) => {
  const [html, setHtml] = useState<string | null>(htmlCache[url] ?? null);
  const [hadError, setHadError] = useState(false);
  const containerId = useRef(id || uniqueId());
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      if (htmlCache[url]) {
        callbackCache[url]?.(containerId.current);
        return;
      }

      try {
        const urlPrefix = fetchUrlPrefix().replace(/^\/$/, "");
        const res = await fetch(urlPrefix + url);

        if (res.status >= 200 && res.status <= 299) {
          const contentType = res.headers.get("content-type");

          if (contentType && contentType.indexOf("application/json") > -1) {
            const json = await res.json();
            const nextHtml = transformHtml(json.html);
            setHtml(nextHtml);
            htmlCache[url] = nextHtml;

            if (json.postRenderCallback) {
              // eslint-disable-next-line no-eval
              const callback = eval(json.postRenderCallback);
              callback(containerId.current);
              callbackCache[url] = callback;
            }
          } else {
            const text = await res.text();
            const nextHtml = transformHtml(text);
            setHtml(nextHtml);
            htmlCache[url] = nextHtml;
          }
        } else {
          throw new Error(`Error rendering async title for url "${url}"`);
        }
      } catch (e) {
        window.console.error(e);
        setHadError(true);
      }
    })();
  }, [id, url, transformHtml]);

  useEffect(() => {
    if (html !== null && onLoad && ref.current) {
      onLoad(html, ref.current);
    }
  }, [id, html, onLoad]);

  if (html === null && !hadError) {
    return <LoadingTile />;
  }

  if (hadError) {
    return <ErrorTile />;
  }

  // Some tiles are rendered as an empty string. This usually means there is no
  // information available for that tile.
  if (html === "") {
    return renderEmptyResponse();
  }

  return (
    <div
      ref={ref}
      id={containerId.current}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
};

export default AsyncTile;
