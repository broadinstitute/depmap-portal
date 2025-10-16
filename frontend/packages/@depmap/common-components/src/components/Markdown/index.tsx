import React, { Suspense } from "react";
import { Spinner } from "../Spinner";
import { LazyMarkdownCore } from "./LazyMarkdownCore";

export interface MarkdownRendererProps {
  children: string;
  className?: string;
}

function Markdown({ children, className = undefined }: MarkdownRendererProps) {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyMarkdownCore className={className}>{children}</LazyMarkdownCore>
    </Suspense>
  );
}

export default Markdown;
