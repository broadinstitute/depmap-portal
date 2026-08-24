jest.mock("../apiCacheDecorator", () => ({
  cached: jest.fn((api: unknown) => api),
}));

import { cached } from "../apiCacheDecorator";
import { breadboxAPI } from "../breadboxAPI";
import {
  evaluateContextPersisted,
  getDimensionTypeIdentifiersPersisted,
} from "../persistedFetches";

const cachedMock = (cached as unknown) as jest.Mock;

const GENE_METADATA_UUID = "aaaaaaaa-0000-0000-0000-000000000001";
const MODEL_METADATA_UUID = "bbbbbbbb-0000-0000-0000-000000000002";

const geneSlice = {
  dataset_id: "some_dataset",
  identifier: "some_column",
  identifier_type: "column" as const,
};

beforeEach(() => {
  cachedMock.mockClear();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  (breadboxAPI as any).getDimensionTypes = jest.fn().mockResolvedValue([
    { name: "gene", metadata_dataset_id: GENE_METADATA_UUID },
    { name: "depmap_model", metadata_dataset_id: MODEL_METADATA_UUID },
    { name: "no_metadata_type", metadata_dataset_id: null },
  ]);

  (breadboxAPI as any).getDimensionTypeIdentifiers = jest
    .fn()
    .mockResolvedValue([]);

  (breadboxAPI as any).evaluateContext = jest
    .fn()
    .mockResolvedValue({ ids: [], labels: [], num_candidates: 0 });
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

describe("getDimensionTypeIdentifiersPersisted", () => {
  it("declares the dimension type's metadata dataset as a dep", async () => {
    await getDimensionTypeIdentifiersPersisted("gene");

    expect(cachedMock).toHaveBeenCalledWith(breadboxAPI, {
      persist: { deps: [GENE_METADATA_UUID] },
    });
    expect(breadboxAPI.getDimensionTypeIdentifiers).toHaveBeenCalledWith(
      "gene"
    );
  });

  it("falls back to in-memory caching without a metadata dataset", async () => {
    await getDimensionTypeIdentifiersPersisted("no_metadata_type");

    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
  });

  it("falls back for an unknown dimension type", async () => {
    await getDimensionTypeIdentifiersPersisted("never_heard_of_it");

    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
  });
});

describe("evaluateContextPersisted", () => {
  it("declares the context's dimension type metadata dataset as a dep", async () => {
    const context = {
      dimension_type: "gene",
      expr: { in: [{ var: "v" }, ["a", "b"]] },
      vars: { v: geneSlice },
    };

    await evaluateContextPersisted(context);

    expect(cachedMock).toHaveBeenCalledWith(breadboxAPI, {
      persist: { deps: [GENE_METADATA_UUID] },
    });
    expect(breadboxAPI.evaluateContext).toHaveBeenCalledWith(context);
  });

  it("includes nested contexts' metadata datasets", async () => {
    const context = {
      dimension_type: "gene",
      expr: true,
      vars: {},
      contexts: {
        c1: {
          name: "nested",
          dimension_type: "depmap_model",
          expr: true,
          vars: {},
        },
      },
    };

    await evaluateContextPersisted(context);

    expect(cachedMock).toHaveBeenCalledWith(breadboxAPI, {
      persist: { deps: [GENE_METADATA_UUID, MODEL_METADATA_UUID] },
    });
  });

  it("falls back when any var uses reindex_through", async () => {
    const context = {
      dimension_type: "gene",
      expr: { in: [{ var: "v" }, ["a"]] },
      vars: {
        v: {
          ...geneSlice,
          reindex_through: geneSlice,
        },
      },
    };

    await evaluateContextPersisted(context);

    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
  });

  it("falls back without throwing on a partial tree with undefined nodes", async () => {
    // REGRESSION: interactive editors (Context Builder) evaluate
    // partially-built contexts. The dep walk crashed on an undefined nested
    // entry instead of downgrading to plain in-memory caching.
    const context = {
      dimension_type: "gene",
      expr: true,
      vars: { v: undefined },
      contexts: { c1: undefined },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await evaluateContextPersisted(context);

    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
    expect(breadboxAPI.evaluateContext).toHaveBeenCalledWith(context);
  });

  it("falls back without throwing when the context itself is undefined", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await evaluateContextPersisted(undefined as any);

    // Downgrades to the plain call, which behaves exactly as it did before
    // persistence existed (including however it chooses to fail).
    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
  });

  it("falls back when a nested dimension type has no metadata dataset", async () => {
    const context = {
      dimension_type: "gene",
      expr: true,
      vars: {},
      contexts: {
        c1: {
          name: "nested",
          dimension_type: "no_metadata_type",
          expr: true,
          vars: {},
        },
      },
    };

    await evaluateContextPersisted(context);

    expect(cachedMock).toHaveBeenLastCalledWith(breadboxAPI);
  });
});
