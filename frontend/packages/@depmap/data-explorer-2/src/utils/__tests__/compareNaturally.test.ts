import { compareNaturally } from "@depmap/utils";

// Lives here rather than beside the function: @depmap/utils has no jest setup
// of its own, and this package's consumers are what the ordering is for.

const sorted = (labels: string[]) => [...labels].sort(compareNaturally);

describe("compareNaturally", () => {
  it("orders a dose series by magnitude", () => {
    // The case this exists for. `Intl.Collator`'s own numeric collation
    // compares runs of digits as integers and a decimal point ends a run, so
    // "0.0100052…" and "0.100035…" compared as 100052698506632 against
    // 100035129252774 — nearly equal — and the series interleaved itself at
    // every power of ten.
    const doses = [
      "ERLOTINIB 0.100035129252774 uM",
      "ERLOTINIB 0.0020010539701326 uM",
      "ERLOTINIB 10.0 UM",
      "ERLOTINIB 0.0100052698506632 uM",
      "ERLOTINIB 2.0 uM",
      "ERLOTINIB 0.0316366632677971 uM",
      "ERLOTINIB 1.00017563084078 uM",
    ];

    expect(sorted(doses)).toEqual([
      "ERLOTINIB 0.0020010539701326 uM",
      "ERLOTINIB 0.0100052698506632 uM",
      "ERLOTINIB 0.0316366632677971 uM",
      "ERLOTINIB 0.100035129252774 uM",
      "ERLOTINIB 1.00017563084078 uM",
      "ERLOTINIB 2.0 uM",
      "ERLOTINIB 10.0 UM",
    ]);
  });

  it("still sorts integers the way numeric collation did", () => {
    // What `numeric: true` was there for in the first place, and the reason
    // plain lexicographic ordering is not the fix.
    expect(sorted(["Sample 10", "Sample 2", "Sample 1"])).toEqual([
      "Sample 1",
      "Sample 2",
      "Sample 10",
    ]);

    expect(sorted(["AKT10", "AKT2", "TP53", "AKT1"])).toEqual([
      "AKT1",
      "AKT2",
      "AKT10",
      "TP53",
    ]);
  });

  it("compares each number in turn, not just the first", () => {
    expect(sorted(["chr10:5", "chr2:100", "chr2:9"])).toEqual([
      "chr2:9",
      "chr2:100",
      "chr10:5",
    ]);
  });

  it("is case-insensitive on the text between numbers", () => {
    expect(sorted(["beta", "Alpha", "gamma"])).toEqual([
      "Alpha",
      "beta",
      "gamma",
    ]);
  });

  it("puts a bare prefix before the same prefix with more after it", () => {
    expect(sorted(["dose 1", "dose"])).toEqual(["dose", "dose 1"]);
  });

  it("treats a hyphen as text rather than a minus sign", () => {
    // Deliberate, and the same choice Intl makes. Reading it as a sign would
    // order "A-2" before "A-1", which is wrong far more often than a genuinely
    // negative label is right.
    expect(sorted(["A-2", "A-10", "A-1"])).toEqual(["A-1", "A-2", "A-10"]);
  });

  it("is a total order — no pair disagrees with itself", () => {
    // A comparator that says a < b and b < a produces an order that depends on
    // the engine's sort implementation, which is the kind of bug that only
    // shows up on someone else's machine.
    const labels = [
      "0.5 uM",
      "0.50 uM",
      "10",
      "10.0",
      "abc",
      "abc1",
      "1abc",
      "",
    ];

    labels.forEach((a) => {
      labels.forEach((b) => {
        const forward = Math.sign(compareNaturally(a, b));
        const backward = Math.sign(compareNaturally(b, a));

        // Stated as a sum rather than `forward === -backward`, which trips over
        // Jest distinguishing 0 from -0 on the equal case.
        expect(forward + backward).toBe(0);
      });
    });
  });
});
