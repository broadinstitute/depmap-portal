/* eslint-disable @typescript-eslint/ban-types */
import { DataExplorerContextV2 } from "@depmap/types";
import launchContextManagerModal from "src/modals/launchContextManagerModal";
import launchStandaloneContextBuilderModal from "src/modals/launchStandaloneContextBuilderModal";

// This is intended to mimic the global functions that are exported from this
// module (but note that it only supports a subset of them at present):
// https://github.com/broadinstitute/depmap-portal/blob/6660c9/frontend/packages/portal-frontend/src/index.tsx
declare global {
  interface Window {
    DepMap: {
      launchContextManagerModal: (options?: {
        initialContextType: string;
      }) => void;

      saveNewContext: (
        context: { dimension_type: string } | DataExplorerContextV2,
        onHide?: (() => void) | null,
        onSave?: ((context: DataExplorerContextV2, hash: string) => void) | null
      ) => void;

      editContext: (context: DataExplorerContextV2, hash: string) => void;

      repairContext: (
        badContext: DataExplorerContextV2
      ) => Promise<DataExplorerContextV2 | null>;
    };
  }
}

window.DepMap = {
  launchContextManagerModal,

  saveNewContext: (context, onHide, onSave) => {
    launchStandaloneContextBuilderModal(context, null, onSave, onHide);
  },

  editContext: (context, hash) => {
    launchStandaloneContextBuilderModal(context, hash);
  },

  repairContext: (context) => {
    return new Promise((resolve) => {
      const onSave = (nextContext: DataExplorerContextV2) => {
        resolve(nextContext);
      };

      const onHide = () => {
        resolve(null);
      };

      launchStandaloneContextBuilderModal(context, null, onSave, onHide);
    });
  },
};
