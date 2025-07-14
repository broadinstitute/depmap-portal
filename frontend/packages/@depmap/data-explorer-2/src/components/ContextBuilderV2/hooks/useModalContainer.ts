import { useEffect } from "react";

// WORKAROUND: Some of our Jinja templates don't include a <div> for a modal to
// be rendered into by React. This will add one to the DOM if that's the case.
function useModalContainer() {
  useEffect(() => {
    let modal = document.querySelector(
      "#modal-container"
    ) as HTMLDivElement | null;

    if (!modal) {
      modal = document.createElement("div");
      document.body.appendChild(modal);
    }

    modal.id = "modal-container";
    modal.style.zIndex = "1051";
    modal.style.position = "absolute";
    modal.style.top = "0";
    modal.setAttribute("data-modal-stacking-mode", "exclusive");
  }, []);
}

export default useModalContainer;
