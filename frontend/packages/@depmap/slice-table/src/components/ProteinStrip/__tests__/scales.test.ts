import { HYDROPHOBICITY_SCALE, TOPOLOGY_SCALE } from "../scales";
import getProteinStripScale from "../columns";

// Nightingale parses both attributes itself and reports nothing useful when it
// can't -- a malformed `color-range` throws inside the element and a malformed
// `scale` logs and renders an uncolored band. These tests pin the string
// formats so a bad edit fails here instead of silently producing a gray strip.

function parsePairs(attr: string): [string, number][] {
  return attr.split(",").map((entry) => {
    const parts = entry.split(":");
    expect(parts).toHaveLength(2);

    return [parts[0], parseFloat(parts[1])];
  });
}

describe("TOPOLOGY_SCALE", () => {
  it("maps each residue code to a distinct positive integer", () => {
    const pairs = parsePairs(TOPOLOGY_SCALE.scale);
    const codes = pairs.map(([code]) => code);
    const values = pairs.map(([, value]) => value);

    expect(codes).toEqual(["S", "O", "M", "I"]);
    expect(new Set(values).size).toBe(values.length);
    values.forEach((value) => {
      expect(Number.isInteger(value)).toBe(true);
      // Zero is reserved for characters absent from the scale, which
      // Nightingale silently assigns that value.
      expect(value).toBeGreaterThan(0);
    });
  });

  it("gives every class value an exact color stop", () => {
    const classValues = parsePairs(TOPOLOGY_SCALE.scale).map(([, v]) => v);
    const stopValues = parsePairs(TOPOLOGY_SCALE.colorRange).map(([, v]) => v);

    // Without an exact stop the class would land midway through d3's linear
    // interpolation and render a blend of two neighbours.
    classValues.forEach((value) => expect(stopValues).toContain(value));
  });

  it("reserves a stop at zero so unknown characters read as unknown", () => {
    const stops = parsePairs(TOPOLOGY_SCALE.colorRange);

    expect(stops[0][1]).toBe(0);
    expect(stops[0][0]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("has a legend entry per class", () => {
    expect(TOPOLOGY_SCALE.legend).toHaveLength(
      TOPOLOGY_SCALE.scale.split(",").length
    );
  });

  it("orders color stops ascending, as d3 requires", () => {
    const values = parsePairs(TOPOLOGY_SCALE.colorRange).map(([, v]) => v);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe("HYDROPHOBICITY_SCALE", () => {
  it("names one of Nightingale's built-in residue tables", () => {
    expect(HYDROPHOBICITY_SCALE.scale).toBe("hydrophobicity-scale");
  });

  it("diverges through a neutral midpoint", () => {
    const stops = parsePairs(HYDROPHOBICITY_SCALE.colorRange);

    expect(stops).toHaveLength(3);
    expect(stops.map(([, v]) => v)).toEqual(
      [...stops.map(([, v]) => v)].sort((a, b) => a - b)
    );
    // The midpoint has to read as "neither", so its channels are near-equal.
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(stops[1][0].slice(i, i + 2), 16)
    );
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(16);
  });
});

describe("getProteinStripScale", () => {
  it("recognizes the topology column", () => {
    expect(
      getProteinStripScale({
        dataset_id: "transcriptome_domain_annotation_merged_annotations",
        identifier: "topology",
        identifier_type: "column",
      })
    ).toBe(TOPOLOGY_SCALE);
  });

  it("recognizes the sequence column", () => {
    expect(
      getProteinStripScale({
        dataset_id: "transcriptome_domain_annotation_merged_annotations",
        identifier: "sequence",
        identifier_type: "column",
      })
    ).toBe(HYDROPHOBICITY_SCALE);
  });

  it("ignores the same identifiers in another dataset", () => {
    expect(
      getProteinStripScale({
        dataset_id: "some_other_dataset",
        identifier: "sequence",
        identifier_type: "column",
      })
    ).toBeNull();
  });

  it("ignores a matching identifier addressed as a feature rather than a column", () => {
    expect(
      getProteinStripScale({
        dataset_id: "transcriptome_domain_annotation_merged_annotations",
        identifier: "topology",
        identifier_type: "feature_id",
      })
    ).toBeNull();
  });

  it("returns null for an ordinary column", () => {
    expect(
      getProteinStripScale({
        dataset_id: "transcript_metadata",
        identifier: "Gene",
        identifier_type: "column",
      })
    ).toBeNull();
  });
});
