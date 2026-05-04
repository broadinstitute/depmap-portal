import React, { useEffect, useRef, useState } from "react";

interface ContainerSizedProps {
  children: (dimensions: { width: number; height: number }) => React.ReactNode;
}

function ContainerSized({ children }: ContainerSizedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100vw", height: "100vh" }}>
      {dimensions && children(dimensions)}
    </div>
  );
}

export default ContainerSized;
