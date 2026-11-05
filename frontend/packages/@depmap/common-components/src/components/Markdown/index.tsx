import React, { Suspense } from "react";
import { Spinner } from "../Spinner";
import { LazyMarkdownCore } from "./LazyMarkdownCore";

export interface MarkdownRendererProps {
  children: string;
  className?: string;
  // Called after the markdown has been converted to HTML and committed to the
  // DOM (and again whenever `children` changes).
  onRendered?: () => void;
}

function Markdown({
  children,
  className = undefined,
  onRendered = undefined,
}: MarkdownRendererProps) {
  return (
    <Suspense fallback={<Spinner position="static" />}>
      <LazyMarkdownCore className={className} onRendered={onRendered}>
        {children}
      </LazyMarkdownCore>
    </Suspense>
  );
}

export default Markdown;
