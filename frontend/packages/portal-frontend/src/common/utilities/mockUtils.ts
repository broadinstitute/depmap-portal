import { DepmapApi } from "src/dAPI";
import { getDapi } from "src/common/utilities/context";

export function mockDapi(impl: Partial<DepmapApi>) {
  (getDapi as any).mockImplementation(() => impl);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
