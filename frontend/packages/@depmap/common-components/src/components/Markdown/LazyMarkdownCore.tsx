import React from "react";
import "github-markdown-css/github-markdown-light.css";

export const LazyMarkdownCore = React.lazy(async () => {
  const ReactMarkdown = (await import("react-markdown")).default;
  const remarkGfm = (await import("remark-gfm")).default;
  const rehypeRaw = (await import("rehype-raw")).default;
  const rehypeSlug = (await import("rehype-slug")).default;

  const Core = ({
    children,
    className = undefined,
    onRendered = undefined,
  }: {
    children: string;
    className?: string;
    onRendered?: () => void;
  }) => {
    // Keep the latest callback in a ref so a new function identity doesn't
    // re-trigger it; it should only fire when the content changes.
    const onRenderedRef = React.useRef(onRendered);
    onRenderedRef.current = onRendered;

    // ReactMarkdown renders synchronously, so by the time this runs the
    // HTML for `children` is already in the DOM.
    React.useEffect(() => {
      onRenderedRef.current?.();
    }, [children]);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // rehypeSlug adds GitHub-style ids to headings (e.g. "Custom Analysis" ->
        // "custom-analysis") so they can be linked to with #anchors. It runs
        // after rehypeRaw so headings written as raw HTML are included, and it
        // leaves any explicitly specified id alone.
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        className={`markdown-body ${className ?? ""}`}
        components={{
          // Make all links open in a new tab
          a: ({ node, children: linkChildren, ...aProps }: any) => (
            <a {...aProps} target="_blank" rel="noopener noreferrer">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    );
  };

  return { default: Core };
});
