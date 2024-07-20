import { DepmapApi } from "src/dAPI";
import { VectorCatalogApi } from "@depmap/interactive";
import { getDapi, getVectorCatalogApi } from "src/common/utilities/context";

export function mockDapi(impl: Partial<DepmapApi>) {
  (getDapi as any).mockImplementation(() => impl);
}

export function mockVectorCatalogApi(impl: Partial<VectorCatalogApi>) {
  (getVectorCatalogApi as any).mockImplementation(() => impl);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
