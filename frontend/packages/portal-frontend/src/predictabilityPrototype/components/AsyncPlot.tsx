import React, { useEffect, useState } from "react";
import PlotSpinner from "../../plot/components/PlotSpinner";

interface AsyncPlotProps<T> {
  loader: () => Promise<T>;
  childComponent: (props: T) => React.ReactNode;
}

export function AsyncPlot<T>({ loader, childComponent }: AsyncPlotProps<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [childProps, setChildProps] = useState(null as any);

  useEffect(() => {
    // fix this -- if error, keeps retrying
    if (!isLoading && childProps == null && error == null) {
      setIsLoading(true);
      loader()
        .then((newChildProps) => {
          setChildProps(newChildProps);
          setIsLoading(false);
        })
        .catch((err: any) => {
          console.log(err);
          setError(`${err}`);
          setIsLoading(false);
        });
    }
  }, [loader, isLoading, childProps, error]);

  if (childProps) {
    return childComponent(childProps);
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <PlotSpinner height={"100%"} />;
}
