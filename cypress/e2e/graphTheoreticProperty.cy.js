import { navbarAction, open, openSubTab } from "../helper";

context("Calculate Theoretic Property", () => {
  beforeEach(open);

  it("TC1: Can calculate degree centrality and set widths", () => {
    navbarAction("Data", "Sample Data");
    openSubTab("Calculate Theoretic Property");

    cy.get("select.form-select.tight-select:visible").select(
      "Degree Centrality"
    );
    cy.get('input[value="Execute"]:visible').click();

    cy.window().then((win) => {
      expect(win.cy.$id("n0").width() == 60).to.eq(true);
      expect(win.cy.$id("n4").width() > 45).to.eq(true);
    });
  });
});
