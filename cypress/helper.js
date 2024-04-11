export const URL = "http://visuall.herokuapp.com/";
// export const URL = 'http://localhost:4200/';

export function open() {
  cy.visit(URL);
}

/** click to open dropdown menu and then click to the action button
 * @param  {string} dropdownBtn text shown on UI
 * @param  {string} actionBtn text shown on UI
 */
export function navbarAction(dropdownBtn, actionBtn) {
  cy.get("button.btn.btn-light.dropdown-toggle:visible")
    .contains(dropdownBtn)
    .click();
  cy.get("button.dropdown-item:visible").contains(actionBtn).click();

  if (dropdownBtn == "Data" && actionBtn == "Sample Data") {
    cy.wait(1500);
    cy.window().then((win) => {
      expect(win.cy.nodes().length > 0).to.eq(true);
    });
  }
  if (dropdownBtn == "Data" && actionBtn == "Clear Data") {
    cy.window().then((win) => {
      expect(win.cy.nodes().length == 0).to.eq(true);
    });
  }
}

/**
 * @param  {string} subTab text shown on UI
 */
export function openSubTab(subTab) {
  cy.get("b.va-heading2:visible").contains(subTab).click();
}

/**
 * @param  {string} s text shown on UI
 */
export function openTab(s) {
  cy.get("a.nav-link").contains(s).click();
}

/** click to "Options" subheading
 */
export function click2options() {
  cy.get("span.va-heading3").contains("Options").click();
  cy.wait(250);
}

/**
 * @param  {string} algoName
 * @param  {boolean} shouldResultCompounds
 */
export function groupBy(algoName, shouldResultCompounds) {
  cy.get("label").contains(algoName).click();
  cy.get('input[value="Execute"]:visible').click();

  cy.window().then((win) => {
    if (shouldResultCompounds) {
      expect(win.cy.$(":parent").length > 0).to.eq(true);
    } else {
      expect(win.cy.$(":parent").length == 0).to.eq(true);
    }
  });
}

/**
 * @param  {string} prop Object type to select
 * @param  {string} op Operator to select
 * @param  {string} input input value as operand
 */
export function addPropertyRule(prop, op, input) {
  cy.get("select.prop").select(prop);
  cy.get("select.prop-op-key").select(op);
  cy.get('input[placeholder="Filter..."]').clear();
  cy.get('input[placeholder="Filter..."]').type(input);
  cy.get('img[title="Add/Update"]').click();
}
