describe("data explorer", () => {
  beforeEach(() => {
    cy.visit("http://127.0.0.1:5000/interactive");
    // Get rid of distracting Flask debugger panel
    cy.window().then((win) => {
      win.document.querySelector("#flDebug").remove();
    });
  });

  it("runs a Pearson correlation custom analysis", () => {
    cy.get(".btn-primary").click();

    cy.get(":nth-child(1) > label").click();

    cy.get("#react-select-4-input")
      .type("Gene", { force: true })
      .trigger("keydown", { keyCode: 9, force: true });

    cy.get("#react-select-5-input")
      .type("SOX10", { force: true })
      .trigger("keydown", { keyCode: 9, force: true });

    cy.get("#react-select-6-input")
      .type("CRISPR", { force: true })
      .trigger("keydown", { keyCode: 9, force: true });

    cy.get("#react-select-3-input")
      .type("RNAi", { force: true })
      .trigger("keydown", { keyCode: 9, force: true });

    cy.intercept("/api/task/*").as("task");
    cy.intercept("/interactive/api/get-features?*").as("getFeatures");
    cy.get('[data-selenium-id="cust-assoc-run-btn"]').click();
    cy.wait(["@task", "@getFeatures"]);

    cy.get("#results-panel-tab-table").click();

    cy.get(".selectedRow > :nth-child(1)").should("have.text", "TRIL");
    cy.get(".selectedRow > :nth-child(2)").should("have.text", " 0.818");
    cy.get(".selectedRow > :nth-child(3)").should("have.text", " 0.0468");
    cy.get(".selectedRow > :nth-child(4)").should("have.text", " 0.0492");
    cy.get(".selectedRow > :nth-child(5)").should("have.text", " 6");

    cy.get(".longTableButtons > div").should("have.text", "11 rows ");
  });
});
