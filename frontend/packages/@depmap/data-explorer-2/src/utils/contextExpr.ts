// This module is part of the standalone Node bundle (see
// embed-frontend/webpack.node.js), so keep it free of storage and `window`.
import type { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";

export const isContextAll = (
  context: DataExplorerContext | DataExplorerContextV2
) => {
  // `true` is a special value used to match on anything.
  return Boolean(context) && context.expr === true;
};
