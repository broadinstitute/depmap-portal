import React from "react";
import "github-markdown-css/github-markdown.css";

export const LazyMarkdownCore = React.lazy(async () => {
  const ReactMarkdown = (await import("react-markdown")).default;
  const remarkGfm = (await import("remark-gfm")).default;
  const rehypeRaw = (await import("rehype-raw")).default;

  return {
    default: (props: { children: string; className?: string }) => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        className={`markdown-body ${props.className ?? ""}`}
        components={{
          // Make all links open in a new tab
          a: ({ node, children, ...aProps }: any) => (
            <a {...aProps} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {props.children}
      </ReactMarkdown>
    ),
  };
});
