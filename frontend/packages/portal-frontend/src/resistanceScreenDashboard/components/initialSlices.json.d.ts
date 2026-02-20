import { SliceQuery } from "@depmap/types";

declare module "./initialSlices.json" {
  const value: SliceQuery[];
  export default value;
}
