import * as utils from "src/celfie/utilities/overrepresentationTableUtils";

describe("createOverrepresentationList", () => {
  const genesetsUp = {
    genes: [
      ["Gene1", "Gene2", "Gene3", "Gene4"],
      ["Gene1", "Gene3", "Gene4"],
      ["Gene2", "Gene4"],
      ["Gene1"],
    ],
    neg_log_p: [0.275, 0.578, 1, 0],
    p_value: [0.0004, 0.0045, 2, 1],
    rank: [0, 1, 2, 3],
    term: ["PATHWAY1", "PATHWAY2", "PATHWAY3", "PATHWAY4"],
    term_short: ["P1", "P2", "P3", "P4"],
    type: ["gene_set_up", "gene_set_up", "gene_set_up", "gene_set_up"],
    n: [],
    x: [],
    y: [],
  };
  const genesetsDown = {
    genes: [
      ["Gene1"],
      ["Gene1", "Gene3", "Gene4"],
      ["Gene1", "Gene2", "Gene3", "Gene4"],
      ["Gene2", "Gene4"],
    ],
    neg_log_p: [0.421, 0.123, 1.5, 0],
    p_value: [0.0003, 0.0321, 2.4, 1],
    rank: [0, 1, 2, 3],
    term: ["PATHWAY5", "PATHWAY6", "PATHWAY7", "PATHWAY8"],
    term_short: ["P1", "P2", "P3", "P4"],
    type: ["gene_set_up", "gene_set_up", "gene_set_up", "gene_set_up"],
    n: [],
    x: [],
    y: [],
  };
  it("creates a overepresentation data object based on the given index", () => {
    expect(utils.reformatData(2, genesetsDown, "Neg")).toEqual({
      direction: "Neg",
      geneset: genesetsDown.term[2],
      idCol: "Neg_" + genesetsDown.term[2],
      negLogP: genesetsDown.neg_log_p[2],
      setSize: genesetsDown.genes[2].length,
    });
  });

  it("creates a list of overrepresentation data in long table props expected format", () => {
    expect(
      utils.createOverrepresentationList(genesetsUp, genesetsDown)
    ).toEqual([
      {
        direction: "Neg",
        geneset: "PATHWAY7",
        idCol: "Neg_PATHWAY7",
        negLogP: 1.5,
        setSize: 4,
      },
      {
        direction: "Pos",
        geneset: "PATHWAY3",
        idCol: "Pos_PATHWAY3",
        negLogP: 1,
        setSize: 2,
      },
      {
        direction: "Pos",
        geneset: "PATHWAY2",
        idCol: "Pos_PATHWAY2",
        negLogP: 0.578,
        setSize: 3,
      },
      {
        direction: "Neg",
        geneset: "PATHWAY5",
        idCol: "Neg_PATHWAY5",
        negLogP: 0.421,
        setSize: 1,
      },
      {
        direction: "Pos",
        geneset: "PATHWAY1",
        idCol: "Pos_PATHWAY1",
        negLogP: 0.275,
        setSize: 4,
      },
      {
        direction: "Neg",
        geneset: "PATHWAY6",
        idCol: "Neg_PATHWAY6",
        negLogP: 0.123,
        setSize: 3,
      },
      {
        direction: "Pos",
        geneset: "PATHWAY4",
        idCol: "Pos_PATHWAY4",
        negLogP: 0,
        setSize: 1,
      },
      {
        direction: "Neg",
        geneset: "PATHWAY8",
        idCol: "Neg_PATHWAY8",
        negLogP: 0,
        setSize: 2,
      },
    ]);
  });
});
