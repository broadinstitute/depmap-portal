import get from "lodash.get";
import { PlotConfigReducerAction } from "./reducers/plotConfigReducer";
import { PartialDataExplorerPlotConfig } from "@depmap/types";

const LOG_REDUCER_TO_CONSOLE = false;

const logHeader = (name: string, color: string) => {
  window.console.log(
    `---%c ${name} %c${"-".repeat(72 - name.length)}`,
    `color:${color}`,
    "color:black"
  );
};

const isNonNullObject = (obj: unknown) => {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
};

const logDiff = (a: object, b: object) => {
  const changedPaths = new Set<string[]>();

  const findChanges = (path: string[]) => {
    const o1 = path.length ? get(a, path) : a;
    const o2 = path.length ? get(b, path) : b;

    if (
      isNonNullObject(o2) &&
      Object.keys(o2).length === 0 &&
      Object.keys(o1 || {}).length > 0
    ) {
      changedPaths.add(path);
      return;
    }

    [o2, o1].forEach((obj) => {
      if (isNonNullObject(obj)) {
        Object.keys(obj).forEach((key) => {
          findChanges([...path, key]);
        });
      } else if (JSON.stringify(o1) !== JSON.stringify(o2)) {
        changedPaths.add(path);
      }
    });
  };

  findChanges([]);
  const printedPaths = new Set<string[]>();
  const hasBeenPrinted = (path: string[]) => {
    for (let i = 1; i <= path.length; i += 1) {
      const found = [...printedPaths].find(
        (p) => `${p}` === `${path.slice(0, i)}`
      );

      if (found) {
        return true;
      }
    }

    return false;
  };

  [...changedPaths]
    .sort((pa, pb) => pa.length - pb.length)
    .forEach((path) => {
      if (hasBeenPrinted(path)) {
        return;
      }

      printedPaths.add(path);

      const before = get(a, path);
      const after = get(b, path);
      const formattedPath = path
        .join(".")
        .replace(/\.([^a-zA-Z])([^.$]*)/g, "['$1$2']");

      window.console.log(
        `%c${formattedPath}`,
        "color: #666; font-style: italic"
      );

      window.console.log({ before, after });
    });
};

export function logInitialPlot(plot: PartialDataExplorerPlotConfig) {
  if (!LOG_REDUCER_TO_CONSOLE) {
    return;
  }

  logHeader("initial plot", "green");
  window.console.log(plot);
}

export function logReducerTransform(
  action: PlotConfigReducerAction,
  plot: PartialDataExplorerPlotConfig,
  nextPlot: PartialDataExplorerPlotConfig
) {
  if (!LOG_REDUCER_TO_CONSOLE) {
    return;
  }

  window.console.log("\n");

  logHeader("action dispatched", "blue");
  window.console.log(
    `type:%c '${action.type}' %c payload:`,
    "color:#DE423C; font-style: italic;",
    "color:black; font-style: normal;",
    typeof action.payload === "string" ? `"${action.payload}"` : action.payload
  );

  logHeader("next value", "green");
  window.console.log(nextPlot);

  logHeader("diff", "purple");
  logDiff(plot, nextPlot);
}

export function logDirectPlotChange(
  caller: string,
  plot: PartialDataExplorerPlotConfig,
  nextPlot: PartialDataExplorerPlotConfig
) {
  if (!LOG_REDUCER_TO_CONSOLE) {
    return;
  }

  window.console.log("\n");

  logHeader("plot updated directly by setPlot()", "blue");
  window.console.log(`calling function: ${caller}()`);

  logHeader("next value", "green");
  window.console.log(nextPlot);

  logHeader("diff", "purple");
  logDiff(plot, nextPlot);
}
