import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { COLLAPSED_EDGE_CLASS, DEFAULT_NODE_WIDTH } from "../../../constants";
import { CytoscapeService } from "../../../cytoscape.service";
import { ExternalToolService } from "../../../external-tool.service";
import { GlobalVariableService } from "../../../global-variable.service";

@Component({
  selector: "app-graph-theoretic-properties-tab",
  templateUrl: "./graph-theoretic-properties-tab.component.html",
  styleUrls: ["./graph-theoretic-properties-tab.component.css"],
})
export class GraphTheoreticPropertiesTabComponent implements OnInit, OnDestroy {
  theoreticProps: { text: string; fn: string; arg: any }[] = [
    { text: "Degree Centrality", fn: "degreeCentrality", arg: "" },
    {
      text: "Normalized Degree Centrality",
      fn: "degreeCentralityNormalized",
      arg: "",
    },
    {
      text: "Inter-Group Degree Centrality",
      fn: "interGroupDegreeCentrality",
      arg: "",
    },
    {
      text: "Normalized Inter-Group Degree Centrality",
      fn: "interGroupDegreeCentralityNormalized",
      arg: "",
    },
    { text: "Closeness Centrality", fn: "closenessCentrality", arg: "" },
    {
      text: "Normalized Closeness Centrality",
      fn: "closenessCentralityNormalized",
      arg: "",
    },
    { text: "Betweenness Centrality", fn: "betweennessCentrality", arg: "" },
    {
      text: "Normalized Betweenness Centrality",
      fn: "betweennessCentralityNormalized",
      arg: "",
    },
    { text: "Page Rank", fn: "pageRank", arg: "" },
  ];
  isOnSelected = false;
  isDirectedGraph = false;
  isMapNodeSizes = true;
  isMapBadgeSizes = false;
  isConsiderOriginalEdges = false;
  selectedPropFn: string = "";
  UPDATE_POPPER_WAIT = 100;
  cySelector = "";
  badgeColor = "#007bff";
  isBadgeVisible = true;
  maxPropertyValue = 0;
  currentNodeSize = DEFAULT_NODE_WIDTH;
  appDescSubscription: Subscription;

  constructor(
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService,
    private _extTool: ExternalToolService
  ) {}

  ngOnInit() {
    this._g.cy.on("remove", (e: any) => {
      this._extTool.destroyBadgePopper(e.target.id(), -1);
    });
    this._g.appDescription.subscribe((x) => {
      if (x !== null && x.appPreferences.avgNodeSize) {
        this.currentNodeSize = x.appPreferences.avgNodeSize;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.appDescSubscription) {
      this.appDescSubscription.unsubscribe();
    }
  }

  // This function is called when the user selects a graph theoretic property
  // from the dropdown list and runs the selected property function
  runProperty() {
    // Reset the cySelector to an empty string to select all nodes
    this.cySelector = "";

    // If the selected property is to be run on selected nodes only, set the
    // cySelector to ":selected"
    if (this.isOnSelected) {
      this.cySelector = ":selected";
    }

    // Destroy the current badge poppers
    this._extTool.destroyCurrentBadgePoppers();

    // If the selected property function is not defined, return
    if (!this[this.selectedPropFn]) {
      return;
    }

    // Set the values for the badge popper
    this._extTool.setBadgePopperValues(
      this.isMapNodeSizes,
      this.isMapBadgeSizes,
      this.currentNodeSize,
      this.maxPropertyValue,
      this.badgeColor
    );

    // Run the selected property function
    this[this.selectedPropFn]();

    this.maxPropertyValue = Math.max(
      ...this._g.cy.nodes().map((x: any) => x.data("__badgeProperty"))
    );

    this._cyService.setNodeSizeOnGraphTheoreticProp(
      this.maxPropertyValue,
      this.currentNodeSize
    );

    this._extTool.setBadgePopperValues(
      this.isMapNodeSizes,
      this.isMapBadgeSizes,
      this.currentNodeSize,
      this.maxPropertyValue,
      this.badgeColor
    );

    this._extTool.setBadgeColorsAndCoords();
  }

  private edgeWeightFn(edge: any) {
    if (this.isConsiderOriginalEdges && edge.hasClass(COLLAPSED_EDGE_CLASS)) {
      return edge.data("collapsedEdges").length;
    }
    return 1;
  }

  degreeCentrality() {
    const elements = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];
      const r = this._g.cy.$(this.cySelector).degreeCentrality({
        root: e,
        directed: this.isDirectedGraph,
        alpha: 1,
        weight: this.edgeWeightFn.bind(this),
      });
      const badges = [];
      if (this.isDirectedGraph) {
        badges.push(r.indegree);
        badges.push(r.outdegree);
      } else {
        badges.push(r.degree);
      }
      this._extTool.generateBadge4Element(e, badges);
    }
  }

  degreeCentralityNormalized() {
    let elements = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).degreeCentralityNormalized({
      directed: this.isDirectedGraph,
      alpha: 1,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elements.length; i++) {
      let badges = [];
      let e = elements[i];
      if (this.isDirectedGraph) {
        badges.push(r.indegree(e));
        badges.push(r.outdegree(e));
      } else {
        badges.push(r.degree(e));
      }
      this._extTool.generateBadge4Element(e, badges);
    }
  }

  interGroupDegreeCentrality() {
    const elements = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];
      const r = this.calcuateInterGroupDegree(e);
      const badges = [];
      if (this.isDirectedGraph) {
        badges.push(r.indegree);
        badges.push(r.outdegree);
      } else {
        badges.push(r.degree);
      }
      this._extTool.generateBadge4Element(e, badges);
    }
  }

  interGroupDegreeCentralityNormalized() {
    const elements = this._g.cy.nodes(this.cySelector);
    const allBadges = [];
    let maxD = -1,
      maxIn = -1,
      maxOut = -1;

    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];
      const r = this.calcuateInterGroupDegree(e);
      const badges = [];
      if (this.isDirectedGraph) {
        badges.push(r.indegree);
        if (r.indegree > maxIn) {
          maxIn = r.indegree;
        }
        badges.push(r.outdegree);
        if (r.outdegree > maxOut) {
          maxOut = r.outdegree;
        }
      } else {
        if (r.degree > maxD) {
          maxD = r.degree;
        }
        badges.push(r.degree);
      }
      allBadges.push(badges);
    }
    if (maxD == 0) {
      maxD = 1;
    }
    if (maxIn == 0) {
      maxIn = 1;
    }
    if (maxOut == 0) {
      maxOut = 1;
    }

    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];
      const badges = allBadges[i];
      if (this.isDirectedGraph) {
        badges[0] /= maxIn;
        badges[1] /= maxOut;
      } else {
        badges[0] /= maxD;
      }
      this._extTool.generateBadge4Element(e, badges);
    }
  }

  private calcuateInterGroupDegree(e: any) {
    if (!e.parent()) {
      if (this.isDirectedGraph) {
        return { degree: 0 };
      }
      return { indegree: 0, outdegree: 0 };
    }

    const myParent = e.parent();
    const myParentId = myParent.id();
    const subgraph = this._g.cy.$(this.cySelector);

    let outDegree = 0;
    const outgoers = e.outgoers("edge");
    for (let i = 0; i < outgoers.length; i++) {
      const tgt = outgoers[i].target();
      if (subgraph.contains(tgt) && tgt.parent().id() != myParentId) {
        outDegree += this.edgeWeightFn(outgoers[i]);
      }
    }

    let inDegree = 0;
    const incomers = e.incomers("edge");
    for (let i = 0; i < incomers.length; i++) {
      const src = incomers[i].source();
      if (subgraph.contains(src) && src.parent().id() != myParentId) {
        inDegree += this.edgeWeightFn(incomers[i]);
      }
    }

    if (this.isDirectedGraph) {
      return { indegree: inDegree, outdegree: outDegree };
    }
    return { degree: inDegree + outDegree };
  }

  closenessCentrality() {
    let elements = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elements.length; i++) {
      let e = elements[i];
      let r = this._g.cy.$(this.cySelector).closenessCentrality({
        root: e,
        directed: this.isDirectedGraph,
        weight: this.edgeWeightFn.bind(this),
      });
      let badges = [r];
      this._extTool.generateBadge4Element(e, badges);
    }
  }

  closenessCentralityNormalized() {
    let elements = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).closenessCentralityNormalized({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elements.length; i++) {
      let badges = [r.closeness(elements[i])];
      this._extTool.generateBadge4Element(elements[i], badges);
    }
  }

  betweennessCentrality() {
    let elements = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).betweennessCentrality({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elements.length; i++) {
      let badges = [r.betweenness(elements[i])];
      this._extTool.generateBadge4Element(elements[i], badges);
    }
  }

  betweennessCentralityNormalized() {
    let elements = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).betweennessCentrality({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elements.length; i++) {
      let badges = [r.betweennessNormalized(elements[i])];
      this._extTool.generateBadge4Element(elements[i], badges);
    }
  }

  pageRank() {
    let elements = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).pageRank();
    for (let i = 0; i < elements.length; i++) {
      let badges = [r.rank(elements[i])];
      this._extTool.generateBadge4Element(elements[i], badges);
    }
  }

  colorSelected(s: string) {
    this.badgeColor = s;
    this._extTool.setBadgePopperValues(
      this.isMapNodeSizes,
      this.isMapBadgeSizes,
      this.currentNodeSize,
      this.maxPropertyValue,
      this.badgeColor
    );
  }

  avgNodeSizeChanged() {
    if (this.currentNodeSize < 5) {
      this.currentNodeSize = 5;
    }
  }
}
