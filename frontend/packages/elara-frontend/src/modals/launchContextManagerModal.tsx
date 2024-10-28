import React from "react";
import ReactDOM from "react-dom";

const ElaraContextManager = React.lazy(
  () =>
    import(
      /* webpackChunkName: "ElaraContextManager" */
      "src/modals/ElaraContextManager"
    )
);

export default function launchContextManagerModal() {
  const container = document.getElementById("cell_line_selector_modal");
  const hide = () => ReactDOM.unmountComponentAtNode(container as HTMLElement);

  // Unmount a previous instance if any (otherwise this is a no-op).
  hide();

  ReactDOM.render(
    <React.Suspense fallback={null}>
      <ElaraContextManager onHide={hide} />
    </React.Suspense>,
    container
  );
}
