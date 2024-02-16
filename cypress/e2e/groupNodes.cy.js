import { groupBy, navbarAction, open, openSubTab } from "../helper";

context("Group Nodes", () => {
  beforeEach(open);

  it("TC1: Can group with Louvain using compounds", () => {
    navbarAction("Data", "Sample Data");
    openSubTab("Group Nodes");

    groupBy("By the Louvain modularity algorithm", true);
    groupBy("None", false);
    groupBy("By the Markov clustering algorithm", true);
    groupBy("None", false);
  });
});
