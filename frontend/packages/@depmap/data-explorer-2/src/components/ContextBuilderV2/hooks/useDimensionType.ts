import { useEffect, useRef, useState } from "react";
import { DimensionType } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { useContextBuilderState } from "../state/ContextBuilderState";

// Mimics the behavior of the built-in Promise.withResolvers().
// That API is still a little too new to safely rely on.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers#browser_compatibility
function withResolvers<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

export default function useDimensionType() {
  const api = useDataExplorerApi();
  const promiseWrapper = useRef(withResolvers<DimensionType>());
  const { dimension_type } = useContextBuilderState();
  const [dimensionType, setDimensionType] = useState<DimensionType | null>(
    null
  );

  useEffect(() => {
    api
      .fetchDimensionTypes()
      .then((types) => {
        const typeInfo = types.find((t) => t.name === dimension_type);

        if (typeInfo) {
          setDimensionType(typeInfo);
          promiseWrapper.current.resolve(typeInfo);
        } else {
          const errorMsg = `Unknown dimension type "${dimension_type}"`;
          promiseWrapper.current.reject(errorMsg);
          throw new Error(errorMsg);
        }
      })
      .catch((e) => {
        window.console.error(e);
        const errorMsg = "Failed to fetch dimension types from Breadbox";
        promiseWrapper.current.reject(errorMsg);
        throw new Error(errorMsg);
      });
  }, [api, dimension_type]);

  return {
    dimensionType,
    isDimensionTypeLoading: dimensionType === null,
    getDimensionTypeAsync: () => promiseWrapper.current.promise,
  } as
    | {
        isDimensionTypeLoading: true;
        dimensionType: null;
        getDimensionTypeAsync: () => Promise<DimensionType>;
      }
    | {
        isDimensionTypeLoading: false;
        dimensionType: DimensionType;
        getDimensionTypeAsync: () => Promise<DimensionType>;
      };
}
