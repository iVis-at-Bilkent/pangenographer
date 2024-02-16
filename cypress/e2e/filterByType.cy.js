import { navbarAction, open } from "../helper";

context("Filter By Node/Edge Type", () => {
  beforeEach(open);

  it("TC1: Filter by node/edge type should show or hide based on type", () => {
    navbarAction("Data", "Sample Data");
    // hide 'Person' node type
    cy.get("a.filter-node-class").contains("Person").click();
    cy.window().then((win) => {
      expect(win.cy.$("node:visible").filter(".Person").length == 0).to.eq(
        true
      );
    });

    // show 'Person' node type
    cy.get("a.filter-node-class").contains("Person").click();
    cy.window().then((win) => {
      expect(win.cy.$("node:visible").filter(".Person").length > 0).to.eq(true);
    });

    // hide 'ACTOR' edge type
    cy.get("a.filter-edge-class").contains("ACTOR").click();
    cy.window().then((win) => {
      expect(win.cy.$("edge:visible").filter(".ACTOR").length == 0).to.eq(true);
    });

    // show 'ACTOR' edge type
    cy.get("a.filter-edge-class").contains("ACTOR").click();
    cy.window().then((win) => {
      expect(win.cy.$("edge:visible").filter(".ACTOR").length > 0).to.eq(true);
    });
  });
});
