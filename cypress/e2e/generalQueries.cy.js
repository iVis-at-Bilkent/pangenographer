import { click2options, navbarAction, open, openTab } from "../helper";

context("General Queries implemented in the backend side", () => {
  beforeEach(open);

  it('TC1: "Get Neigborhood" query should bring some nodes and edges', () => {
    navbarAction("Data", "Sample Data");
    openTab("Database");

    cy.get("select.form-select:visible").select("Get neighborhood");

    cy.get('img[title="Select nodes to add"]').click();

    cy.window().then((win) => {
      win.cy.nodes()[0].select();
    });

    cy.get('img[title="Complete selection"]').click();

    navbarAction("Data", "Clear Data");
    cy.wait(1000);

    cy.get("input#isGraph.form-check-input:visible").eq(0).check();
    cy.get('input[value="Execute"]:visible').click();

    cy.wait(3000);

    cy.window().then((win) => {
      expect(win.cy.nodes().length > 3).to.eq(true);
      expect(win.cy.edges().length > 3).to.eq(true);
    });
  });

  it('TC2: "Get graph of interest" query should bring some nodes and edges', () => {
    navbarAction("Data", "Sample Data");
    openTab("Database");

    cy.get("select.form-select:visible").select("Get graph of interest");

    cy.get('img[title="Select nodes to add"]').click();

    cy.window().then((win) => {
      win.cy.$id("n1").select();
      win.cy.$id("n4").select();
    });

    cy.get('img[title="Complete selection"]').click();

    navbarAction("Data", "Clear Data");
    cy.wait(1000);

    click2options();
    cy.get("input.form-control.inp-3-char:visible").clear();
    cy.get("input.form-control.inp-3-char:visible").type(4);
    // uncheck directed
    cy.get('input[type="checkbox"].form-check-input:visible').uncheck();
    click2options();

    // check graph
    cy.get("input#isGraph.form-check-input:visible").eq(0).check();
    cy.get('input[value="Execute"]:visible').click();

    cy.wait(3000);

    cy.window().then((win) => {
      expect(win.cy.nodes().length > 2).to.eq(true);
      expect(win.cy.edges().length > 2).to.eq(true);
    });
  });

  it('TC3: "Get common targets/regulators" query should bring some nodes and edges', () => {
    navbarAction("Data", "Sample Data");
    openTab("Database");

    cy.get("select.form-select:visible").select(
      "Get common targets/regulators"
    );

    cy.get('img[title="Select nodes to add"]').click();

    cy.window().then((win) => {
      win.cy.$id("n1").select();
      win.cy.$id("n4").select();
    });

    cy.get('img[title="Complete selection"]').click();

    navbarAction("Data", "Clear Data");
    cy.wait(1000);

    click2options();

    // uncheck directed
    cy.get('input[type="checkbox"].form-check-input:visible').uncheck();
    click2options();

    // check graph
    cy.get("input#isGraph.form-check-input:visible").eq(0).check();
    cy.get('input[value="Execute"]:visible').click();

    cy.wait(3000);

    cy.window().then((win) => {
      expect(win.cy.nodes().length > 2).to.eq(true);
      expect(win.cy.edges().length > 2).to.eq(true);
    });
  });
});
