import React, { useEffect, useState } from "react";

function useTableHeight(contentRef: React.RefObject<HTMLDivElement>) {
  const [fixedHeight, setFixedHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const onResize = () => {
      if (contentRef.current) {
        const viewportHeight = window.innerHeight;
        const contentHeight = contentRef.current.offsetHeight;
        const NAVBAR_HEIGHT = 50;
        const autoHeight = viewportHeight - contentHeight - NAVBAR_HEIGHT;

        setFixedHeight(Math.max(autoHeight, 300));
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [contentRef]);

  return { fixedHeight };
}

export default useTableHeight;
