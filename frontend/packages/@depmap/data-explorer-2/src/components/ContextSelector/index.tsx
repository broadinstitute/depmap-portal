import React from "react";
import { isElara } from "@depmap/globals";
import ContextSelectorV1 from "./ContextSelectorV1";
import ContextSelectorV2 from "../ContextSelectorV2";

type Props = React.ComponentProps<typeof ContextSelectorV1>;

// eslint-disable-next-line react/require-default-props
function ContextSelectorWrapper(props: Props) {
  return isElara ? (
    <ContextSelectorV2 {...(props as any)} />
  ) : (
    <ContextSelectorV1 {...props} />
  );
}

export default ContextSelectorWrapper;
