import React from "react";
import ReactDOM from "react-dom";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import { DataExplorerContextV2 } from "@depmap/types";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

const ElaraStandaloneContextBuilder = React.lazy(
  () =>
    import(
      /* webpackChunkName: "ElaraStandaloneContextBuilder" */
      "src/modals/ElaraStandaloneContextBuilder"
    )
);

export default function launchStandaloneContextBuilderModal(
  /* The context to use as a starting point. This can be as simple as
   * { dimension_type: '...' } if that's all the information you know. */
  context: { dimension_type: string } | DataExplorerContextV2,

  /* Supply a hash if an existing context should be replaced by the edited one
   * or null if this should be considered a brand new context. */
  hash: string | null,

  // Only called on save.
  onSave?: ((context: DataExplorerContextV2, hash: string) => void) | null,

  // Call when saved and when dismissed.
  onHide?: (() => void) | null
) {
  const container = document.getElementById("cell_line_selector_modal");
  const hide = () => ReactDOM.unmountComponentAtNode(container as HTMLElement);

  // Unmount a previous instance if any (otherwise this is a no-op).
  hide();

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <ElaraStandaloneContextBuilder
          context={context}
          hash={hash}
          onSave={onSave}
          onHide={() => {
            if (onHide) {
              onHide();
            }

            hide();
          }}
        />
      </PlotlyLoaderProvider>
    </React.Suspense>,
    container
  );
}
