import {
  addPropertyRule,
  navbarAction,
  open,
  openSubTab,
  openTab,
} from "../helper";

context("Query By Rule", () => {
  beforeEach(open);

  function beginQueryByRule() {
    openSubTab("Query by Rule");
    cy.get('img[alt="Add Rule"]:visible').click();
    cy.wait(250);
  }

  function queryByConditionRuleGetAll(type, isEdge) {
    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    selectClass4QueryRule(type);
    cy.get('img[title="Add/Update"]').click();

    click2Execute(true);
    cy.wait(4000);

    if (isEdge) {
      cy.window().then((win) => {
        expect(win.cy.$(`.${type}`).length > 0).to.eq(true);
      });
    } else {
      cy.window().then((win) => {
        expect(
          win.cy.$(`.${type}`).length > 0 &&
            win.cy.$().not(`.${type}`).length == 0
        ).to.eq(true);
      });
    }
  }

  function selectClass4QueryRule(type) {
    cy.get("select.rule-class:visible").select(type);
  }

  function click2Execute(isCheckLoadGraph) {
    if (isCheckLoadGraph) {
      cy.get("input.cb-is-load-graph").check();
    }
    cy.get('input[value="Execute"]:visible').click();
  }

  it('TC1: rule for "birth > 1994 AND death < 2020"', () => {
    beginQueryByRule();
    cy.get("button:visible").contains("AND").click();
    addPropertyRule("birth_year", "≥", "1994");
    cy.get('img[title="Add"]:visible').click();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("death_year", "≤", "2020");
    click2Execute(true);
    cy.wait(4000);

    cy.window().then((win) => {
      const isAllInRange =
        win.cy.$("[birth_year<1994],[death_year>2020]").length == 0 &&
        win.cy.$("[birth_year>=1994],[death_year<=2020]").length > 0;
      expect(isAllInRange).to.eq(true);
    });
  });

  it("TC2: Condition get All Persons", () => {
    queryByConditionRuleGetAll("Person", false);
  });

  it("TC3: Condition get All COMPOSER", () => {
    queryByConditionRuleGetAll("COMPOSER", true);
  });

  it("TC4: Edit Rule Condition", () => {
    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("primary_name", "contains", "John");
    click2Execute(true);

    cy.window().then((win) => {
      const canGetAllJohns =
        win.cy.$(".Person").filter("[primary_name *='John']").length ==
        win.cy.$().length;
      expect(canGetAllJohns).to.eq(true);
    });

    cy.get('img[title="Edit"]').click();
    addPropertyRule("primary_name", "contains", "Tom");
    click2Execute(false);

    cy.window().then((win) => {
      const canGetAllJohnsAndToms =
        win.cy
          .$(".Person")
          .filter("[primary_name *='John'],[primary_name *='Tom']").length ===
        win.cy.$().length;
      expect(canGetAllJohnsAndToms).to.eq(true);
    });
  });

  it("TC5: Should be able to delete rule and change class of the rule", () => {
    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("primary_name", "contains", "John");
    cy.get('img[title="Delete"]:visible').click();
    selectClass4QueryRule("EDITOR");
    cy.get("b").contains("EDITOR").should("be.visible");
  });

  it("TC6: Should be able to run a nested rule", () => {
    beginQueryByRule();
    cy.get("button:visible").contains("AND").click();
    addPropertyRule("primary_name", "contains", "Jo");

    // start inner OR
    cy.get('img[title="Add"]:visible').click();
    cy.get("button:visible").contains("OR").click();
    cy.get('img[title="Add"]:visible').eq(0).click();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("ACTRESS", ">", "3");

    // second rule of inner OR
    cy.get('img[title="Add"]:visible').eq(0).click();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("ACTOR", ">", "3");
    click2Execute(true);

    cy.window().then((win) => {
      const canGetAllJos =
        win.cy.$("[.Person][primary_name *='Jo']").length == win.cy.$().length;
      expect(canGetAllJos).to.eq(true);
    });
  });

  it("TC7: Test if table works", () => {
    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    cy.get('img[title="Add/Update"]').click();
    click2Execute(false);
    cy.wait(3000);

    cy.window().then((win) => {
      expect(win.cy.$().length == 0).to.eq(true);
    });

    cy.get('input[placeholder="Search..."]').clear();
    cy.get('input[placeholder="Search..."]').type("T");

    // order by
    cy.get("a.table-header").contains("birth year").click();

    // merge selected to graph
    cy.get("input.cb-table-all").check();
    cy.get('img[title="Merge selected to graph"]').click();
    cy.wait(3000);

    // download as CSV
    cy.get('img[title="Download selected objects"]').click();

    cy.window().then((win) => {
      const cntElem1 = win.cy.$().length;
      expect(cntElem1 == 15).to.eq(true);
    });
    cy.get("input.cb-is-load-graph").check();
    cy.get("a.page-link").last().click();
    cy.window().then((win) => {
      const cntElem2 = win.cy.$().length;
      const hasAllToms =
        win.cy.$("[primary_name *= 'T']").length > 0 &&
        win.cy.$("[primary_name *= 'T']").length == win.cy.$().length;
      expect(hasAllToms).to.eq(true);
      expect(20 == cntElem2).to.eq(true);
    });

    navbarAction("Data", "Clear");

    // uncheck "Merge"
    cy.get("input.cb-is-merge-graph").uncheck();
    cy.get("a.page-link").first().click();

    cy.window().then((win) => {
      const cntElem3 = win.cy.$().length;
      expect(cntElem3 == 15).to.eq(true);
    });
  });

  it("TC8: Client-side filtering should work properly", () => {
    navbarAction("Data", "Sample Data");
    openTab("Settings");

    // show query results with "selected"
    cy.get('input[name="optradio1"]').eq(1).click();
    openTab("Map");

    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    addPropertyRule("ACTOR", ">", "3");
    cy.get("input.cb-is-on-db").uncheck();
    click2Execute(false);

    cy.window().then((win) => {
      const cntFiltered = win.cy
        .$(":selected")
        .filter((x) => x.connectedEdges(".ACTOR").length > 3).length;
      const cntSelected = win.cy.$(":selected").length;
      expect(cntFiltered > 0).to.eq(true);
      expect(cntSelected === cntFiltered).to.eq(true);
    });
  });

  it("TC9: Can add/remove query", () => {
    beginQueryByRule();
    cy.get("button:visible").contains("Condition").click();
    cy.get('img[title="Add/Update"]').click();

    cy.get('input[value="Add"]').click();
    // reload the page, the new rule should be also reloaded
    open();

    openSubTab("Query by Rule");
    cy.get("span.pointer").contains("New rule").should("be.visible");
    cy.get('img[title="Delete query rule"]').click();
    cy.get("span.pointer").should("not.exist");
  });

  // checks https://github.com/ugurdogrusoz/visuall/issues/341
  it("TC10: Highlight graph element and corresponding table row on hover", () => {
    openTab("Settings");
    cy.get('input[type="checkbox"]:visible').eq(2).click();
    openTab("Map");
    queryByConditionRuleGetAll("Person", false);

    cy.window().then((win) => {
      win.cy.nodes()[0].emit("mouseover");
      const isHigh = win.cy.nodes()[0].classes().join().includes("emphasize");
      expect(isHigh).to.eq(true);
    });
    cy.get("tr.highlighted-row").should("be.visible");
  });
});
