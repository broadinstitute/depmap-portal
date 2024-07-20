import React, { useLayoutEffect, useRef, useState } from "react";

interface Props {
  className: string;
}

function EndOfSupportBanner({ className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    const parentEl = ref.current?.parentElement;

    if (parentEl) {
      parentEl.style.paddingTop = hidden ? "0" : "50px";

      if (document.querySelector("#alert-banner")) {
        ref.current!.style.top = "88px";
        parentEl.style.paddingBottom = "40px";
      }

      if (hidden) {
        window.dispatchEvent(new Event("resize"));
      }
    }
  }, [hidden]);

  if (hidden) {
    return <div ref={ref} />;
  }

  return (
    <div ref={ref} className={className}>
      <div />
      <div>
        <span>
          Data Explorer 1 has reached its end of support and will be removed in
          a future release.
        </span>
      </div>
      <button type="button" className="close" onClick={() => setHidden(true)}>
        <span aria-hidden="true">&times;</span>
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}

export default EndOfSupportBanner;
