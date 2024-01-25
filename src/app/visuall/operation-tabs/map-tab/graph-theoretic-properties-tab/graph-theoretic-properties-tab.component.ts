import { formatNumber } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import {
  COLLAPSED_EDGE_CLASS,
  debounce,
  debounce2,
  mapColor,
} from "../../../constants";
import { CytoscapeService } from "../../../cytoscape.service";
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
  poppedData: {
    popper: HTMLDivElement;
    elem: any;
    fn: Function;
    fn2: Function;
  }[] = [];
  UPDATE_POPPER_WAIT = 100;
  cySelector = "";
  badgeColor = "#007bff";
  isBadgeVisible = true;
  readonly ZOOM_THRESHOLD = 0.8;
  readonly NODE_SIZE = 40;
  maxPropValue = 0;
  currNodeSize = this.NODE_SIZE;
  appDescSubs: Subscription;

  constructor(
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService
  ) {}

  ngOnInit() {
    this._cyService.setRemovePoppersFn(this.destroyCurrentPoppers.bind(this));
    this._g.cy.on("remove", (e: any) => {
      this.destroyPopper(e.target.id());
    });
    this._g.appDescription.subscribe((x) => {
      if (x !== null && x.appPreferences.avgNodeSize) {
        this.currNodeSize = x.appPreferences.avgNodeSize;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.appDescSubs) {
      this.appDescSubs.unsubscribe();
    }
  }

  runProperty() {
    this.cySelector = "";
    if (this.isOnSelected) {
      this.cySelector = ":selected";
    }
    this.destroyCurrentPoppers();
    if (!this[this.selectedPropFn]) {
      return;
    }
    this[this.selectedPropFn]();
    let m = Math.max(
      ...this._g.cy.nodes().map((x: any) => x.data("__graphTheoreticProp"))
    );
    this.maxPropValue = m;
    this._cyService.setNodeSizeOnGraphTheoreticProp(m, this.currNodeSize);
    this.setBadgeColorsAndCoords();
  }

  private edgeWeightFn(edge: any) {
    if (this.isConsiderOriginalEdges && edge.hasClass(COLLAPSED_EDGE_CLASS)) {
      return edge.data("collapsedEdges").length;
    }
    return 1;
  }

  degreeCentrality() {
    const elems = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
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
      this.generateBadge4Elem(e, badges);
    }
  }

  degreeCentralityNormalized() {
    let elems = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).degreeCentralityNormalized({
      directed: this.isDirectedGraph,
      alpha: 1,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elems.length; i++) {
      let badges = [];
      let e = elems[i];
      if (this.isDirectedGraph) {
        badges.push(r.indegree(e));
        badges.push(r.outdegree(e));
      } else {
        badges.push(r.degree(e));
      }
      this.generateBadge4Elem(e, badges);
    }
  }

  interGroupDegreeCentrality() {
    const elems = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
      const r = this.calcuateInterGroupDegree(e);
      const badges = [];
      if (this.isDirectedGraph) {
        badges.push(r.indegree);
        badges.push(r.outdegree);
      } else {
        badges.push(r.degree);
      }
      this.generateBadge4Elem(e, badges);
    }
  }

  interGroupDegreeCentralityNormalized() {
    const elems = this._g.cy.nodes(this.cySelector);
    const allBadges = [];
    let maxD = -1,
      maxIn = -1,
      maxOut = -1;

    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
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

    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
      const badges = allBadges[i];
      if (this.isDirectedGraph) {
        badges[0] /= maxIn;
        badges[1] /= maxOut;
      } else {
        badges[0] /= maxD;
      }
      this.generateBadge4Elem(e, badges);
    }
  }

  private calcuateInterGroupDegree(e) {
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
    let elems = this._g.cy.nodes(this.cySelector);
    for (let i = 0; i < elems.length; i++) {
      let e = elems[i];
      let r = this._g.cy.$(this.cySelector).closenessCentrality({
        root: e,
        directed: this.isDirectedGraph,
        weight: this.edgeWeightFn.bind(this),
      });
      let badges = [r];
      this.generateBadge4Elem(e, badges);
    }
  }

  closenessCentralityNormalized() {
    let elems = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).closenessCentralityNormalized({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elems.length; i++) {
      let badges = [r.closeness(elems[i])];
      this.generateBadge4Elem(elems[i], badges);
    }
  }

  betweennessCentrality() {
    let elems = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).betweennessCentrality({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elems.length; i++) {
      let badges = [r.betweenness(elems[i])];
      this.generateBadge4Elem(elems[i], badges);
    }
  }

  betweennessCentralityNormalized() {
    let elems = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).betweennessCentrality({
      directed: this.isDirectedGraph,
      weight: this.edgeWeightFn.bind(this),
    });
    for (let i = 0; i < elems.length; i++) {
      let badges = [r.betweennessNormalized(elems[i])];
      this.generateBadge4Elem(elems[i], badges);
    }
  }

  pageRank() {
    let elems = this._g.cy.nodes(this.cySelector);
    let r = this._g.cy.$(this.cySelector).pageRank();
    for (let i = 0; i < elems.length; i++) {
      let badges = [r.rank(elems[i])];
      this.generateBadge4Elem(elems[i], badges);
    }
  }

  generateBadge4Elem(e, badges: number[]) {
    const div = document.createElement("div");
    div.innerHTML = this.getHtml(badges);
    div.style.position = "absolute";
    div.style.top = "0px";
    div.style.left = "0px";
    document.getElementById("cy").appendChild(div);

    if (this.isMapNodeSizes || this.isMapBadgeSizes) {
      let sum = 0;
      for (let i = 0; i < badges.length; i++) {
        sum += badges[i];
      }
      e.data("__graphTheoreticProp", sum / badges.length);
    }
    if (this.isMapNodeSizes) {
      e.removeClass("graphTheoreticDisplay");
      e.addClass("graphTheoreticDisplay");
    }

    const positionHandlerFn = debounce2(
      () => {
        this.setBadgeCoords(e, div);
        this.setBadgeCoordsOfChildren(e);
      },
      this.UPDATE_POPPER_WAIT,
      () => {
        this.showHideBadge(false, div);
      }
    ).bind(this);
    const styleHandlerFn = debounce(() => {
      this.setBadgeVisibility(e, div);
    }, this.UPDATE_POPPER_WAIT * 2).bind(this);

    e.on("position", positionHandlerFn);
    e.on("style", styleHandlerFn);
    this._g.cy.on("pan zoom resize", positionHandlerFn);
    this.poppedData.push({
      popper: div,
      elem: e,
      fn: positionHandlerFn,
      fn2: styleHandlerFn,
    });
  }

  private setBadgeCoords(e, div: HTMLDivElement) {
    // let the nodes resize first
    setTimeout(() => {
      let ratio = 1;
      if (this.isMapBadgeSizes) {
        let b = this.currNodeSize + 20;
        let a = Math.max(5, this.currNodeSize - 20);
        let x = e.data("__graphTheoreticProp");
        ratio = (((b - a) * x) / this.maxPropValue + a) / this.currNodeSize;
      } else {
        ratio = this.currNodeSize / this.NODE_SIZE;
      }
      ratio = ratio < this.ZOOM_THRESHOLD ? this.ZOOM_THRESHOLD : ratio;

      let z1 = (this._g.cy.zoom() / 2) * ratio;
      const bb = e.renderedBoundingBox({
        includeLabels: false,
        includeOverlays: false,
      });
      const w = div.clientWidth;
      const h = div.clientHeight;
      const deltaW4Scale = ((1 - z1) * w) / 2;
      const deltaH4Scale = ((1 - z1) * h) / 2;
      div.style.transform = `translate(${bb.x2 - deltaW4Scale - w * z1}px, ${
        bb.y1 - deltaH4Scale
      }px) scale(${z1})`;
      this.showHideBadge(e.visible(), div);
    }, 0);
  }

  private setBadgeCoordsOfChildren(e) {
    const elems = e.children();
    for (let i = 0; i < elems.length; i++) {
      const child = elems[i];
      if (child.isParent()) {
        this.setBadgeCoordsOfChildren(child);
      } else {
        const idx = this.poppedData.findIndex((x) => x.elem.id() == child.id());
        if (idx > -1) {
          this.setBadgeCoords(
            this.poppedData[idx].elem,
            this.poppedData[idx].popper
          );
        }
      }
    }
  }

  private setBadgeVisibility(e, div: HTMLDivElement) {
    if (!e.visible()) {
      div.style.opacity = "0";
    }
  }

  destroyCurrentPoppers() {
    let size = this.poppedData.length;
    for (let i = 0; i < size; i++) {
      this.destroyPopper("", 0);
    }
  }

  destroyPopper(id: string, i: number = -1) {
    if (i < 0) {
      i = this.poppedData.findIndex((x) => x.elem.id() == id);
      if (i < 0) {
        return;
      }
    }
    this.poppedData[i].popper.remove();
    // unbind previously bound functions
    if (this.poppedData[i].fn) {
      this.poppedData[i].elem.off("position", this.poppedData[i].fn);
      this.poppedData[i].elem.off("style", this.poppedData[i].fn2);
      this._g.cy.off("pan zoom resize", this.poppedData[i].fn);
    }
    this.poppedData[i].elem.removeClass("graphTheoreticDisplay");
    this.poppedData[i].elem.data("__graphTheoreticProp", undefined);
    this.poppedData.splice(i, 1);
  }

  getHtml(badges: number[]): string {
    let s = "";
    for (let i = 0; i < badges.length; i++) {
      s += `<span class="badge badge-pill badge-primary strokeme">${formatNumber(
        badges[i],
        "en",
        "1.0-2"
      )}</span>`;
    }
    return s;
  }

  showHideBadges(isShow: boolean) {
    let z = this._g.cy.zoom();
    if (z <= this.ZOOM_THRESHOLD) {
      isShow = false;
    }
    let css = "0";
    if (isShow) {
      css = "1";
    }
    for (let i = 0; i < this.poppedData.length; i++) {
      this.poppedData[i].popper.style.opacity = css;
    }
  }

  showHideBadge(isShow: boolean, div: HTMLDivElement) {
    let z = this._g.cy.zoom();
    if (z <= this.ZOOM_THRESHOLD) {
      isShow = false;
    }
    let css = "0";
    if (isShow) {
      css = "1";
    }
    div.style.opacity = css;
  }

  setBadgeColorsAndCoords() {
    for (let i = 0; i < this.poppedData.length; i++) {
      let c = mapColor(
        this.badgeColor,
        this.maxPropValue,
        this.poppedData[i].elem.data("__graphTheoreticProp")
      );
      for (let j = 0; j < this.poppedData[i].popper.children.length; j++) {
        (
          this.poppedData[i].popper.children[j] as HTMLSpanElement
        ).style.background = c;
      }
      this.setBadgeCoords(this.poppedData[i].elem, this.poppedData[i].popper);
    }
  }

  colorSelected(s: string) {
    this.badgeColor = s;
  }

  avgNodeSizeChanged() {
    if (this.currNodeSize < 5) {
      this.currNodeSize = 5;
    }
  }
}
