// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const IDENTIFIER_TYPES = [
  "feature_id",
  "feature_label",
  "sample_id",
  "sample_label",
  "column",
] as const;

type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

type SliceQuery = {
  dataset_id: string;
  identifier: string;
  identifier_type: IdentifierType;
  reindex_through?: SliceQuery;
};

type SliceQuerySet = {
  dimension_type: string;
  slices: SliceQuery[];
};

// ---------------------------------------------------------------------------
// Error type — lets callers `catch` parse failures specifically.
// ---------------------------------------------------------------------------

class SliceQueryParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SliceQueryParseError";
    // `cause` is standard at runtime, but the constructor option is only typed
    // when the ES2022 Error lib is present. Assign it directly so this compiles
    // regardless of the workspace's `lib` target.
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable description of an unexpected value, for error messages. */
function describe(value: unknown): string {
  if (value === undefined) return "undefined (missing)";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return `a ${t} (${JSON.stringify(value)})`;
  }
  return t === "object" ? "an object" : `a ${t}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode (possibly URL-safe) base64 into a UTF-8 string. */
function base64ToString(b64: string): string {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertSliceQuery(
  value: unknown,
  path: string
): asserts value is SliceQuery {
  if (!isPlainObject(value)) {
    throw new SliceQueryParseError(
      `${path} must be an object, but got ${describe(value)}`
    );
  }

  if (typeof value.dataset_id !== "string") {
    throw new SliceQueryParseError(
      `${path}.dataset_id must be a string, but got ${describe(value.dataset_id)}`
    );
  }

  if (typeof value.identifier !== "string") {
    throw new SliceQueryParseError(
      `${path}.identifier must be a string, but got ${describe(value.identifier)}`
    );
  }

  if (
    typeof value.identifier_type !== "string" ||
    !IDENTIFIER_TYPES.includes(value.identifier_type as IdentifierType)
  ) {
    throw new SliceQueryParseError(
      `${path}.identifier_type must be one of ` +
        `${IDENTIFIER_TYPES.join(", ")}, but got ${describe(value.identifier_type)}`
    );
  }

  if (value.reindex_through !== undefined) {
    assertSliceQuery(value.reindex_through, `${path}.reindex_through`);
  }
}

function assertSliceQuerySet(
  value: unknown
): asserts value is SliceQuerySet {
  if (!isPlainObject(value)) {
    throw new SliceQueryParseError(
      `Expected a JSON object at the top level, but got ${describe(value)}`
    );
  }

  if (typeof value.dimension_type !== "string") {
    throw new SliceQueryParseError(
      `"dimension_type" must be a string, but got ${describe(value.dimension_type)}`
    );
  }

  if (!Array.isArray(value.slices)) {
    throw new SliceQueryParseError(
      `"slices" must be an array, but got ${describe(value.slices)}`
    );
  }

  value.slices.forEach((slice, i) => assertSliceQuery(slice, `slices[${i}]`));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Read a base64-encoded SliceQuerySet from the query string.
 *
 * @param paramName  Name of the query-string parameter holding the base64 blob.
 * @param search     The query string to read (defaults to window.location.search).
 * @throws {SliceQueryParseError} if the param is missing, not base64, not JSON,
 *         or does not conform to the SliceQuerySet shape.
 */
function readSliceQuerySetFromQueryString(
  paramName = "q",
  search: string = window.location.search
): SliceQuerySet {
  const raw = new URLSearchParams(search).get(paramName);

  if (raw === null) {
    throw new SliceQueryParseError(
      `Query string is missing the "${paramName}" parameter`
    );
  }

  let jsonString: string;
  try {
    jsonString = base64ToString(raw);
  } catch (cause) {
    throw new SliceQueryParseError(
      `The "${paramName}" parameter is not valid base64`,
      { cause }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (cause) {
    throw new SliceQueryParseError(
      `The "${paramName}" parameter did not decode to valid JSON`,
      { cause }
    );
  }

  assertSliceQuerySet(parsed);
  return parsed;
}

export {
  IDENTIFIER_TYPES,
  SliceQueryParseError,
  assertSliceQuery,
  assertSliceQuerySet,
  readSliceQuerySetFromQueryString,
};
export type { IdentifierType, SliceQuery, SliceQuerySet };
