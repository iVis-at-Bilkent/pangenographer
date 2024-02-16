import { navbarAction, open } from "../helper";

context("Global properties about Visuall", () => {
  beforeEach(open);

  it("TC1: Can show object properties by selecting", () => {
    navbarAction("Data", "Sample Data");
    cy.window().then((win) => {
      win.cy.nodes()[0].select();
    });

    cy.get("div#prop-tab.collapse.show").should("be.visible");
  });

  it('TC2: Should maintain settings when "Store user profile" is checked (true by default)', () => {
    cy.get("a.nav-link").contains("Settings").click();
    cy.get("label")
      .contains("Emphasize on hover")
      .siblings('input[type="checkbox"]')
      .first()
      .should("not.to.be.checked");
    cy.get("label")
      .contains("Emphasize on hover")
      .siblings('input[type="checkbox"]')
      .first()
      .check();
    open();
    cy.get("a.nav-link").contains("Settings").click();
    cy.get("label")
      .contains("Emphasize on hover")
      .siblings('input[type="checkbox"]')
      .first()
      .should("be.checked");
    cy.get("label")
      .contains("Emphasize on hover")
      .siblings('input[type="checkbox"]')
      .first()
      .should("be.checked");
  });
});
