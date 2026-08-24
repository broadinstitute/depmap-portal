import { makeCompatibleExpression } from "../expressionUtils";

// A column whose values are ids of another dimension type — e.g.
// compound_dose_metadata.CompoundID, holding compound_v2 given_ids.
const referenceDomain = {
  value_type: "text",
  references: "compound_v2",
  unique_values: ["DPC-000001", "DPC-000002"],
  dimension_type: "compound_dose",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// An ordinary text column, referencing nothing.
const plainDomain = {
  value_type: "text",
  references: null,
  unique_values: ["Skin", "Lung"],
  dimension_type: "depmap_model",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("makeCompatibleExpression on a reference column", () => {
  it("leaves an ordinary equality alone", () => {
    // The regression this covers: reference columns used to be forced to
    // `in_context`, so a generated context's "CompoundID is DPC-000001" was
    // rewritten into an empty context picker the moment the builder resolved
    // the column's domain.
    const expr = { "==": [{ var: "0" }, "DPC-000001"] };

    expect(makeCompatibleExpression(expr, referenceDomain)).toEqual(expr);
  });

  it("leaves a list membership alone", () => {
    const expr = { in: [{ var: "0" }, ["DPC-000001", "DPC-000002"]] };

    expect(makeCompatibleExpression(expr, referenceDomain)).toEqual(expr);
  });

  it("keeps in_context, along with the context it points at", () => {
    const expr = { in_context: [{ var: "0" }, { context: "some-hash" }] };

    expect(makeCompatibleExpression(expr, referenceDomain)).toEqual(expr);
  });

  it("gives in_context an empty context rather than a literal", () => {
    const expr = { in_context: [{ var: "0" }, "DPC-000001"] };

    expect(makeCompatibleExpression(expr, referenceDomain)).toEqual({
      in_context: [{ var: "0" }, { context: null }],
    });
  });

  it("falls back to the ordinary default, not to in_context", () => {
    // `has_any` is a list_strings operator, invalid for a text column. What it
    // resets TO is the point: `==`, the default for the value type.
    const expr = { has_any: [{ var: "0" }, ["DPC-000001"]] };

    expect(makeCompatibleExpression(expr, referenceDomain)).toEqual({
      "==": [{ var: "0" }, null],
    });
  });
});

describe("makeCompatibleExpression on a non-reference column", () => {
  it("rejects in_context, which has nothing to resolve against", () => {
    const expr = { in_context: [{ var: "0" }, { context: "some-hash" }] };

    expect(makeCompatibleExpression(expr, plainDomain)).toEqual({
      "==": [{ var: "0" }, null],
    });
  });

  it("rejects a context value paired with an ordinary operator", () => {
    // The legacy shape, from when in_context flattened to `in` on emission.
    const expr = { in: [{ var: "0" }, { context: "some-hash" }] };

    expect(makeCompatibleExpression(expr, plainDomain)).toEqual({
      "==": [{ var: "0" }, null],
    });
  });

  it("still filters values against the column's domain", () => {
    const expr = { "==": [{ var: "0" }, "Neptune"] };

    expect(makeCompatibleExpression(expr, plainDomain)).toEqual({
      "==": [{ var: "0" }, null],
    });
  });
});
