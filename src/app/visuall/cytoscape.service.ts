import { Injectable, NgZone } from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import cytoscape from "cytoscape";
import { LouvainClustering } from "../../lib/louvain-clustering/LouvainClustering";
import * as C from "./constants";
import { CyExtService } from "./cy-ext.service";
import {
  CyEdge,
  CyNode,
  GFAData,
  GraphElem,
  GraphResponse,
} from "./db-service/data-types";
import { DbAdapterService } from "./db-service/db-adapter.service";
import { ExternalToolService } from "./external-tool.service";
import { FileReaderService } from "./file-reader.service";
import { GlobalVariableService } from "./global-variable.service";
import { LoadGraphFromFileModalComponent } from "./popups/load-graph-from-file-modal/load-graph-from-file-modal.component";
import { UserPrefHelper } from "./user-pref-helper";
import {
  GroupingOptionTypes,
  MergedElemIndicatorTypes,
} from "./user-preference";
import { UserProfileService } from "./user-profile.service";
@Injectable({
  providedIn: "root",
})
export class CytoscapeService {
  userPrefHelper: UserPrefHelper;
  removePopperFn: Function;
  showObjPropsFn: Function;
  showStatsFn: Function;
  louvainClusterer: LouvainClustering;

  constructor(
    private _g: GlobalVariableService,
    private _cyExtService: CyExtService,
    private _profile: UserProfileService,
    private _ngZone: NgZone,
    private _modalService: NgbModal,
    private _dbService: DbAdapterService,
    private _fileReaderService: FileReaderService,
    private _externalToolService: ExternalToolService
  ) {
    this.userPrefHelper = new UserPrefHelper(this, this._g, this._profile);
    this.louvainClusterer = new LouvainClustering();
  }

  initCy(containerElem: HTMLElement) {
    this._cyExtService.registerExtensions();

    this._g.layout = this._g.getFcoseOptions();
    this._ngZone.runOutsideAngular(() => {
      this._g.cy = cytoscape({
        container: containerElem,
        layout: this._g.layout,
        // initial viewport state:
        zoom: 1,
        pan: { x: 0, y: 0 },
        // interaction options:
        minZoom: 1e-50,
        maxZoom: 1e50,
        zoomingEnabled: true,
        userZoomingEnabled: true,
        panningEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: true,
        selectionType: "single",
        touchTapThreshold: 8,
        desktopTapThreshold: 4,
        autolock: false,
        autoungrabify: false,
        autounselectify: false,
        // rendering options:
        headless: false,
        styleEnabled: true,
        hideEdgesOnViewport: false,
        hideLabelsOnViewport: false,
        textureOnViewport: false,
        motionBlur: false,
        motionBlurOpacity: 0.2,
        wheelSensitivity: 0.1,
        pixelRatio: "auto",
      });
    });
    this._cyExtService.bindExtensions();
    this.bindComponentSelector();

    this.bindSelectObjOfThisType();
    (<any>window).cy = this._g.cy;
    this._g.cy.on("select unselect", (e: any) => {
      this._ngZone.run(() => {
        this.elemSelected(e);
      });
    });
    this._g.cy.on("select unselect add remove tap", () => {
      this._ngZone.run(() => {
        this.statsChanged();
      });
    });
    this._g.cy.on(
      "add",
      C.debounce(this.applyStyle4NewElements, C.CY_BATCH_END_DELAY).bind(this)
    );
    this.userPrefHelper.listen4UserPref();
    this._g.listen4graphEvents();
  }

  private elemSelected(e: any) {
    if (e.type == "select") {
      if (this._g.isSwitch2ObjTabOnSelect) {
        this._g.operationTabChanged.next(0);
      }
    }
    if (this.showObjPropsFn) {
      this.showObjPropsFn();
    }
  }

  private statsChanged() {
    if (this.showStatsFn) {
      this.showStatsFn();
    }
  }

  private applyStyle4NewElements() {
    this._g.cy.startBatch();
    this.fitLabel2Node();
    this.showHideEdgeLabels();
    setTimeout(() => {
      this._g.cy.endBatch();
    }, C.CY_BATCH_END_DELAY);
  }

  setNodeSizeOnGraphTheoreticProp(maxVal: number, avgSize: number) {
    if (maxVal <= 0) {
      maxVal = 1;
    }
    this._g.cy
      .style()
      .selector("node.graphTheoreticDisplay")
      .style({
        width: (e: any) => {
          let b = avgSize + 20;
          let a = Math.max(5, avgSize - 20);
          let x = e.data("__graphTheoreticProp");
          return ((b - a) * x) / maxVal + a + "px";
        },
        height: (e: any) => {
          let b = avgSize + 20;
          let a = Math.max(5, avgSize - 20);
          let x = e.data("__graphTheoreticProp");
          return ((((b - a) * x) / maxVal + a) * e.height()) / e.width() + "px";
        },
      })
      .update();
  }

  bindViewUtilitiesExtension() {
    this._cyExtService.bindViewUtilitiesExtension();
  }

  setNavigatorPosition() {
    this._cyExtService.setNavigatorPosition();
  }

  loadElementsFromDatabase(data: GraphResponse, isIncremental: boolean) {
    if (!isIncremental) {
      this._g.cy.panBy({ x: 2000, y: 2000 }); // Remove the flash effect
    }

    if (!data || !data.nodes || !data.edges) {
      this._g.showErrorModal("Empty Graph", "Empty response from database!");
      return;
    }

    const nodes = data.nodes;
    const edges = data.edges;

    let elemIds: string[] = [];
    let cyNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      let cyNodeId = "n" + nodes[i].elementId;
      cyNodes.push(this.createCyNode(nodes[i], cyNodeId));
      elemIds.push(cyNodeId);
    }

    this._g.userPrefs.isAutoIncrementalLayoutOnChange.next(isIncremental);

    let cyEdges = [];
    let collapsedEdgeIds = {};
    if (isIncremental) {
      collapsedEdgeIds = this.getCollapsedEdgeIds();
    }
    for (let i = 0; i < edges.length; i++) {
      let cyEdgeId = "e" + edges[i].elementId;
      if (collapsedEdgeIds[cyEdgeId]) {
        elemIds.push(collapsedEdgeIds[cyEdgeId]);
        continue;
      }
      cyEdges.push(this.createCyEdge(edges[i], cyEdgeId));
      elemIds.push(cyEdgeId);
    }

    this._g.switchLayoutRandomization(!isIncremental);

    if (!isIncremental) {
      this._g.cy.elements().remove();
    }
    let prevElems = this._g.cy.$(":visible");
    const wasEmpty = this._g.cy.elements().length < 2;

    this._g.cy.add(cyNodes);
    const filteredCyEdges = [];
    for (let i = 0; i < cyEdges.length; i++) {
      const sId = cyEdges[i].data.source;
      const eId = cyEdges[i].data.target;
      if (
        (this._g.cy.$id(sId).length < 1 &&
          !nodes.find((x) => x.elementId == sId)) ||
        (this._g.cy.$id(eId).length < 1 &&
          !nodes.find((x) => x.elementId == eId))
      ) {
        continue;
      }
      filteredCyEdges.push(cyEdges[i]);
    }
    const addedEdges = this._g.cy.add(filteredCyEdges);

    let compoundEdgeIds = Object.values(collapsedEdgeIds) as string[];
    if (this._g.userPrefs.isCollapseMultiEdgesOnLoad.getValue()) {
      this.collapseMultiEdges(addedEdges, false);
    }
    let compoundEdgeIds2 = this._g.cy
      .edges("." + C.COLLAPSED_EDGE_CLASS)
      .map((x: any) => x.id());
    elemIds.push(...C.arrayDiff(compoundEdgeIds, compoundEdgeIds2));
    // elements might already exist but hidden, so show them
    const elemIdSet = new Set(elemIds);
    this._g.viewUtils.show(
      this._g.cy
        .elements()
        .filter((element: any) => elemIdSet.has(element.id()))
    );

    if (!isIncremental) {
      this._dbService.getPathWalkData((data) => {
        let pathsWalks = [];
        for (let i = 0; i < data.nodes.length; i++) {
          let cyNodeId = "n" + data.nodes[i].elementId;
          pathsWalks.push(this.createCyNode(data.nodes[i], cyNodeId));
        }
        this._g.cy.add(pathsWalks);
        this._g.hideTypesNotToShow();
      });
    }

    this._g.applyClassFiltering();

    let current = this._g.cy.nodes(":visible");
    if (isIncremental && !wasEmpty) {
      let collection = this._g.cy.collection();
      for (let i = 0; i < cyNodes.length; i++) {
        let node = this._g.cy.getElementById(cyNodes[i].data.id);
        if (!current.contains(node)) {
          collection = collection.union(node);
        }
      }
      this._g.layoutUtils.placeNewNodes(collection);
    }

    const shouldRandomize = !isIncremental || wasEmpty;
    const hasNew = this.hasNewElem(elemIds, prevElems);
    if (hasNew) {
      this._g.performLayout(shouldRandomize);
    }

    if (isIncremental) {
      this.highlightElems(elemIds);
    }

    this._g.isLoadFromDB = true;

    this._externalToolService.removeExternalTools();
    this._externalToolService.addExternalTools(
      this.showUpDownstream.bind(this)
    );
    this.applyStyle4NewElements();
  }

  showUpDownstream(ele: any, length: number, isUp: boolean) {
    const callback = (data: any) => {
      this.loadElementsFromDatabase(data, true);
    };
    this._g.layout.clusters = null;
    this._dbService.getElementsUpToCertainDistance(
      ele.data().segmentName,
      length,
      callback,
      isUp
    );
  }

  hasNewElem(newElemIds: string[], prevElems: any): boolean {
    let d = {};

    for (let i = 0; i < prevElems.length; i++) {
      d[prevElems[i].id()] = true;
    }

    for (let i = 0; i < newElemIds.length; i++) {
      if (!d[newElemIds[i]]) {
        return true;
      }
    }
    return false;
  }

  collapseMultiEdges(edges2collapse?: any, isSetFlag = true) {
    if (!edges2collapse) {
      edges2collapse = this._g.cy.edges(":visible");
    }
    edges2collapse = edges2collapse.filter("[^originalEnds]"); // do not collapse meta-edges
    let sourceTargetPairs = {};
    let isCollapseBasedOnType =
      this._g.userPrefs.isCollapseEdgesBasedOnType.getValue();
    let edgeCollapseLimit = this._g.userPrefs.edgeCollapseLimit.getValue();
    for (let i = 0; i < edges2collapse.length; i++) {
      let e = edges2collapse[i];
      const s = e.data("source");
      const t = e.data("target");
      let edgeId = s + t;
      if (isCollapseBasedOnType) {
        edgeId = e.classes()[0] + s + t;
      }
      if (!sourceTargetPairs[edgeId]) {
        sourceTargetPairs[edgeId] = { cnt: 1, s: s, t: t };
      } else {
        sourceTargetPairs[edgeId]["cnt"] += 1;
      }
    }
    for (let i in sourceTargetPairs) {
      let curr = sourceTargetPairs[i];
      if (curr.cnt < edgeCollapseLimit) {
        continue;
      }
      let edges = this._g.cy.edges(`[source="${curr.s}"][target="${curr.t}"]`);
      this._g.expandCollapseApi.collapseEdges(edges);
    }
    if (isSetFlag) {
      this._g.isLoadFromExpandCollapse = true;
    }
  }

  expandMultiEdges(edges2expand?: any) {
    if (!edges2expand) {
      edges2expand = this._g.cy.edges("." + C.COLLAPSED_EDGE_CLASS);
    }
    edges2expand = edges2expand.not("." + C.META_EDGE_CLASS);
    this._externalToolService.addTooltips(
      undefined,
      this._g.expandCollapseApi.expandEdges(edges2expand).edges,
      false,
      true
    );
    this._g.isLoadFromExpandCollapse = true;
  }

  collapseNodes() {
    if (this._g.cy.nodes(":parent").length > 0) {
      this._g.expandCollapseApi.collapseAll();
    }
  }

  private getCollapsedEdgeIds(): any {
    let compoundEdges = this._g.cy.edges("." + C.COLLAPSED_EDGE_CLASS);
    let collapsedEdgeIds = {};
    for (let i = 0; i < compoundEdges.length; i++) {
      let collapsed = compoundEdges[i].data("collapsedEdges");
      for (let j = 0; j < collapsed.length; j++) {
        collapsedEdgeIds[collapsed[j].id()] = compoundEdges[i].id();
      }
    }
    return collapsedEdgeIds;
  }

  highlightElems(elemIds: string[]) {
    // remove all existing hightlights before hightlighting new elements
    const newElemIndicator = this._g.userPrefs.mergedElemIndicator.getValue();
    if (newElemIndicator == MergedElemIndicatorTypes.none) {
      return;
    }

    if (this._g.userPrefs.isOnlyHighlight4LatestQuery.getValue()) {
      if (newElemIndicator == MergedElemIndicatorTypes.highlight) {
        this._g.removeHighlights();
      }
      if (newElemIndicator == MergedElemIndicatorTypes.selection) {
        this._g.cy.$().unselect();
      }
    }

    let ele2highlight = this._g.cy.collection();
    const cnt = elemIds.length;
    for (let i = 0; i < cnt; i++) {
      ele2highlight.merge(this._g.cy.$id(elemIds.pop()));
    }
    if (newElemIndicator == MergedElemIndicatorTypes.selection) {
      this._g.isSwitch2ObjTabOnSelect = false;
      ele2highlight.select();
      this._g.isSwitch2ObjTabOnSelect = true;
    } else if (newElemIndicator == MergedElemIndicatorTypes.highlight) {
      this._g.highlightElements(ele2highlight);
    }
  }

  createCyNode(node: CyNode, id: string) {
    const classes = node.labels.join(" ");
    let properties = node.properties;
    properties.id = id;

    return { data: properties, classes: classes };
  }

  createCyEdge(edge: CyEdge, id: string) {
    let properties = edge.properties || {};
    properties.id = id;
    properties.source = "n" + edge.startNodeElementId;
    properties.target = "n" + edge.endNodeElementId;

    return { data: properties, classes: edge.type };
  }

  showHideEdgeLabels() {
    this._g.cy.startBatch();
    this._g.cy.edges().removeClass("nolabel");
    if (!this._g.userPrefs.isShowEdgeLabels.getValue()) {
      this._g.cy.edges().addClass("nolabel");
    }
    setTimeout(() => {
      this._g.cy.endBatch();
    }, C.CY_BATCH_END_DELAY);
  }

  fitLabel2Node() {
    this._g.cy.startBatch();
    let nodes = this._g.cy
      .nodes()
      .not(":parent")
      .not("." + C.CLUSTER_CLASS);
    C.TYPES_NOT_TO_SHOW.forEach((type) => {
      nodes = nodes.not("." + type);
    });
    nodes.removeClass("ellipsis_label");
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].hasClass("SEGMENT")) {
        let toFit =
          this.truncateTextNode(nodes[i].data("segmentName")) +
          "\n" +
          this.truncateTextNode(nodes[i].data("segmentData"));
        nodes[i].data("__label__", toFit);
      } else {
        nodes[i].data("__label__", "");
      }
    }
    nodes.addClass("ellipsis_label");
    setTimeout(() => {
      this._g.cy.endBatch();
    }, C.CY_BATCH_END_DELAY);
  }

  truncateTextNode(label: string) {
    if (label.length > 8) {
      return label.substring(0, 6) + "..";
    } else {
      return label;
    }
  }

  bindHighlightOnHoverListeners() {
    let highlighterFn = this.highlightNeighbors();
    let events = `${C.EV_MOUSE_ON} ${C.EV_MOUSE_OFF}`;
    let targets = "node, edge";
    this._g.cy.on(events, targets, highlighterFn.bind(this));
  }

  highlightNeighbors() {
    return function (event: {
      target: any;
      type: string;
      cySelector?: string;
    }) {
      let elements2remain = null;
      if (event.cySelector != undefined) {
        elements2remain = this._g.cy.$(event.cySelector);
      } else {
        elements2remain = event.target.neighborhood().union(event.target);
        if (event.target.isEdge()) {
          elements2remain = event.target.connectedNodes().union(event.target);
        }
      }

      if (event.type === C.EV_MOUSE_ON) {
        elements2remain.addClass("emphasize");
      } else {
        elements2remain.removeClass("emphasize");
      }
    }.bind(this);
  }

  setOtherElementsOpacity(elements, opacity) {
    this._g.cy.startBatch();
    this._g.cy.elements().difference(elements).style({ opacity: opacity });
    setTimeout(() => {
      this._g.cy.endBatch();
    }, C.CY_BATCH_END_DELAY);
  }

  highlightSelected() {
    const selected = this._g.cy.$(":selected");
    if (selected.length < 1) {
      return;
    }
    this._g.highlightElements(selected);
  }

  staticHighlightNeighbors() {
    let selected = this._g.cy.$(":selected");
    let neighbors = selected.neighborhood();
    this._g.highlightElements(selected.union(neighbors));
  }

  removeHighlights() {
    this._g.removeHighlights();
    this._g.viewUtils.removeHighlights(this._g.filterRemovedElems(() => true));
    this.removePopperFn();
  }

  unbindHighlightOnHoverListeners() {
    this._g.cy.off(`${C.EV_MOUSE_ON} ${C.EV_MOUSE_OFF}`, "node, edge");
  }

  highlighterCheckBoxClicked(isChecked: boolean) {
    if (!isChecked) {
      this.unbindHighlightOnHoverListeners();
    } else {
      this.bindHighlightOnHoverListeners();
    }
  }

  navigatorCheckBoxClicked(isChecked: boolean) {
    if (isChecked) {
      this._cyExtService.bindNavigatorExtension();
    } else {
      this._cyExtService.unbindNavigatorExtension();
    }
  }

  loadFile(file: File) {
    this._fileReaderService.readTxtFile(file, (txt) => {
      try {
        if (this._g.cy.$().length == 0) {
          this._g.expandCollapseApi.loadJson(txt, false);
          this._externalToolService.addExternalTools(this.showUpDownstream);
        } else {
          const modal = this._modalService.open(
            LoadGraphFromFileModalComponent
          );
          modal.componentInstance.txt = txt;
        }
      } catch (e) {
        this._g.showErrorModal("Load", "Cannot process provided JSON file!");
      }
    });
  }

  readGFAFile(file: File, cb: (GFAData: GFAData) => void) {
    let type = file.name.substring(file.name.lastIndexOf(".") + 1);
    if (type === "gfa") {
      this._fileReaderService.readGFAFile(file, (GFAData: GFAData) => {
        cb(GFAData);
      });
    } else {
      this._g.showErrorModal(
        "File type is not suitable",
        type + " is not suitable!"
      );
    }
  }

  readGFASample(sample: string, cb: (GFAData: GFAData) => void) {
    this._fileReaderService.readGFASample(sample, (GFAData: GFAData) => {
      cb(GFAData);
    });
  }

  private str2file(str: string, fileName: string) {
    const blob = new Blob([str], { type: "text/plain" });
    const anchor = document.createElement("a");

    anchor.download = fileName;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.dataset.downloadurl = [
      "text/plain",
      anchor.download,
      anchor.href,
    ].join(":");
    anchor.click();
  }

  saveAsTxt(content: string, fileName: string) {
    this.str2file(content, fileName);
  }

  saveAsJson() {
    this._g.expandCollapseApi.saveJson(this._g.cy.$(), "visuall.json");
  }

  saveSelectedAsJson() {
    this._g.expandCollapseApi.saveJson(
      this._g.cy.$(":selected"),
      "visuall.json"
    );
  }

  saveAsCSV(objs: GraphElem[]) {
    if (!objs || objs.length < 1) {
      return;
    }

    const cols = ["className"].concat(Object.keys(objs[0].data));
    const arr: string[][] = [];
    arr.push(cols);
    for (const o of objs) {
      arr.push([
        o.classes.split(" ")[0],
        ...(Object.values(o.data) as string[]),
      ]);
    }
    const str = arr.map((x) => x.join("|")).join("\n");
    this.str2file(str, "visuall_objects.csv");
  }

  saveAsPng(isWholeGraph: boolean) {
    const options = { bg: "white", scale: 3, full: isWholeGraph };
    const base64png: string = this._g.cy.png(options);
    // just giving base64 string as link gives error on big images
    fetch(base64png)
      .then((res) => res.blob())
      .then((x) => {
        const anchor = document.createElement("a");
        anchor.download = "visuall.png";
        anchor.href = window.URL.createObjectURL(x);
        anchor.click();
      });
  }

  deleteSelected(event) {
    if (event) {
      const ele = event.target || event.cyTarget;
      if (ele.id()[0] === "n") {
        this._externalToolService.removeExternalTools([ele]);
      }
      this._g.cy.remove(ele);
    } else {
      this._externalToolService.removeExternalTools(
        this._g.cy.nodes(":selected")
      );
      this._g.cy.remove(":selected");
    }
    this._g.handleCompoundsOnHideDelete();
    this._g.performLayout(false);
  }

  deleteElements(data: GraphResponse, sourceNodeName: string) {
    for (let i = 0; i < data.nodes.length; i++) {
      for (let j = 0; j < this._g.cy.nodes().length; j++) {
        if (
          data.nodes[i].properties.segmentName !== sourceNodeName &&
          data.nodes[i].properties.segmentName ===
            this._g.cy.nodes()[j].data().segmentName
        ) {
          this._externalToolService.removeExternalTools(this._g.cy.nodes()[j]);
          this._g.cy.remove(this._g.cy.nodes()[j]);
        }
      }
    }
    this._g.handleCompoundsOnHideDelete();
    this._g.performLayout(false);
  }

  addParentNode(idSuffix: string | number, parent = undefined): string {
    const id = "c" + idSuffix;
    const parentNode = this.createCyNode(
      {
        labels: [C.CLUSTER_CLASS],
        properties: { end_datetime: 0, begin_datetime: 0, name: name },
        elementId: "",
      },
      id
    );
    this._g.cy.add(parentNode);
    this._g.cy.elements(`[id = "${id}"]`).move({ parent: parent });
    return id;
  }

  addGroup4Selected() {
    const elems = this._g.cy.nodes(":selected");
    if (elems.length < 1) {
      return;
    }
    const parent = elems[0].parent().id();
    for (let i = 1; i < elems.length; i++) {
      if (parent !== elems[i].parent().id()) {
        return;
      }
    }
    if (
      this._g.userPrefs.groupingOption.getValue() ==
      GroupingOptionTypes.compound
    ) {
      const id = new Date().getTime();
      this.addParentNode(id, parent);
      for (let i = 0; i < elems.length; i++) {
        elems[i].move({ parent: "c" + id });
      }
    } else {
      const currCluster: string[] = elems.map((x: any) => x.id());
      if (!this._g.layout.clusters || this._g.layout.clusters.length < 1) {
        this._g.layout.clusters = [currCluster];
      } else {
        this.removeElementsFromCurrentClusters(elems);
        this._g.layout.clusters.push(currCluster);
      }
      this.removeEmptyClusters();
    }

    this._g.performLayout(false);
  }

  removeElementsFromCurrentClusters(elems: any) {
    if (!this._g.layout.clusters) {
      return;
    }
    const currCluster: string[] = elems.map((x: any) => x.id());
    // remove elements from current clusters
    for (const cluster of this._g.layout.clusters) {
      for (const item of currCluster) {
        const idx = cluster.indexOf(item);
        if (idx > -1) {
          cluster.splice(idx, 1);
        }
      }
    }
  }

  removeEmptyClusters() {
    if (!this._g.layout.clusters) {
      return;
    }
    const nonEmptyClusters = [];
    for (const cluster of this._g.layout.clusters) {
      if (cluster.length > 0) {
        nonEmptyClusters.push(cluster);
      }
    }
    this._g.layout.clusters = nonEmptyClusters;
  }

  removeGroup4Selected(
    elems = undefined,
    isRunLayout = true,
    isCompoundGrouping = null
  ) {
    if (isCompoundGrouping === null) {
      isCompoundGrouping =
        this._g.userPrefs.groupingOption.getValue() ==
        GroupingOptionTypes.compound;
    }
    if (!elems) {
      elems = this._g.cy.nodes(":selected");
      if (isCompoundGrouping) {
        elems = elems.filter("." + C.CLUSTER_CLASS);
      }
    }
    if (elems.length < 1) {
      return;
    }
    if (isCompoundGrouping) {
      for (let i = 0; i < elems.length; i++) {
        // expand if collapsed
        if (elems[i].hasClass(C.COLLAPSED_NODE_CLASS)) {
          this._g.expandCollapseApi.expand(
            elems[i],
            C.EXPAND_COLLAPSE_FAST_OPT
          );
        }
        const grandParent = elems[i].parent().id() ?? null;
        const children = elems[i].children();
        children.move({ parent: grandParent });
        this._g.cy.remove(elems[i]);
      }
    } else {
      this.removeElementsFromCurrentClusters(elems);
      this.removeEmptyClusters();
    }

    if (isRunLayout) {
      this._g.performLayout(false);
    }
  }

  showHideSelectedElements(isHide: boolean) {
    if (isHide) {
      let selected = this._g.cy.$(":selected").not("." + C.META_EDGE_CLASS);
      this._g.viewUtils.hide(selected);
      this.hideCompounds(selected);
      this._g.applyClassFiltering();
      if (selected.length > 0) {
        this._g.performLayout(false);
      }
    } else {
      if (!this.isAnyHidden()) {
        return;
      }
      const prevVisible = this._g.cy.$(":visible");
      this._g.viewUtils.show(this._g.cy.$());
      this._g.applyClassFiltering();
      this._g.hideTypesNotToShow();
      this.showCollapsed(null, null);
      const currVisible = this._g.cy.$(":visible");
      if (!currVisible.same(prevVisible)) {
        if (prevVisible.length > 0) {
          this._g.layoutUtils.placeNewNodes(
            currVisible.difference(prevVisible).nodes()
          );
        }
        this._g.performLayout(false);
      }
    }
  }

  hideUnselected() {
    let unselected = this._g.cy
      .$()
      .not(":selected")
      .not("." + C.META_EDGE_CLASS);
    this._g.viewUtils.hide(unselected);
    this.hideCompounds(unselected);
    this._g.applyClassFiltering();
    if (unselected.length > 0) {
      this._g.performLayout(false);
    }
  }

  showCollapsed(collapsedNodes, collapsedEdges) {
    if (!collapsedNodes) {
      collapsedNodes = this._g.cy.$("." + C.COLLAPSED_NODE_CLASS);
    }
    for (let i = 0; i < collapsedNodes.length; i++) {
      this.showCollapsed4Node(collapsedNodes[i]);
    }
    if (!collapsedEdges) {
      collapsedEdges = this._g.cy.$("." + C.COLLAPSED_EDGE_CLASS);
    }
    for (let i = 0; i < collapsedEdges.length; i++) {
      this.showCollapsed4Edge(collapsedEdges[i]);
    }
  }

  showCollapsed4Node(node: any) {
    const collapsed = node.data("collapsedChildren");
    this._g.viewUtils.show(collapsed);
    const collapsedNodes = collapsed.filter("." + C.COLLAPSED_NODE_CLASS);
    for (let i = 0; i < collapsedNodes.length; i++) {
      this.showCollapsed4Node(collapsedNodes[i]);
    }

    const collapsedEdges = collapsed.filter("." + C.COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < collapsedEdges.length; i++) {
      this.showCollapsed4Edge(collapsedEdges[i]);
    }
  }

  showCollapsed4Edge(edge: any) {
    const collapsed = edge.data("collapsedEdges");
    this._g.viewUtils.show(collapsed);
    const collapsedEdges = collapsed.filter("." + C.COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < collapsedEdges.length; i++) {
      this.showCollapsed4Edge(collapsedEdges[i]);
    }
  }

  // expands all the compound nodes and deletes them recursively
  hideCompounds(elems: any) {
    const nodes = elems
      .filter("." + C.CLUSTER_CLASS)
      .not("." + C.META_EDGE_CLASS);
    let collapsedEdgeIds = elems
      .union(elems.connectedEdges())
      .filter("." + C.COLLAPSED_EDGE_CLASS)
      .map((x) => x.id());
    const edgeIdDict = {};
    for (const i of collapsedEdgeIds) {
      edgeIdDict[i] = true;
    }
    for (let i = 0; i < nodes.length; i++) {
      this.hideCompoundNode(nodes[i], edgeIdDict);
    }
    for (let i in edgeIdDict) {
      this.hideCompoundEdge(this._g.cy.edges("#" + i));
    }
  }

  hideCompoundNode(node: any, edgeIdDict: any) {
    let children = node.children(); // a node might have children
    let collapsed = node.data("collapsedChildren"); // a node might a collapsed
    let collapsedEdgeIds = children
      .connectedEdges()
      .filter("." + C.COLLAPSED_EDGE_CLASS)
      .map((x: any) => x.id());

    if (collapsed) {
      children = children.union(collapsed);
      collapsedEdgeIds = collapsed
        .edges("." + C.COLLAPSED_EDGE_CLASS)
        .map((x: any) => x.id());
      this._g.expandCollapseApi.expand(node, C.EXPAND_COLLAPSE_FAST_OPT);
    }
    for (const i of collapsedEdgeIds) {
      edgeIdDict[i] = true;
    }

    // recursively apply for complex children
    const compoundNodes = children.filter("." + C.CLUSTER_CLASS);
    for (let i = 0; i < compoundNodes.length; i++) {
      this.hideCompoundNode(compoundNodes[i], edgeIdDict);
    }

    // in recursive calls chilren are modified, this node should be an expanded compound node
    children = node.children(); // a node might have children
    children.move({ parent: node.data("parent") ?? null });
    this._g.viewUtils.hide(children);
    this._g.cy.remove(node);
  }

  hideCompoundEdge(edge: any) {
    if (
      !edge ||
      edge.length < 1 ||
      edge.not("." + C.META_EDGE_CLASS).length < 1
    ) {
      return;
    }
    let children = edge.data("collapsedEdges");
    // recursively apply for complex children
    const compoundEdges = children.filter("." + C.COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < compoundEdges.length; i++) {
      this.hideCompoundEdge(compoundEdges[i]);
    }
    this._g.viewUtils.hide(children);
    this._g.expandCollapseApi.expandEdges(edge);
  }

  isAnyHidden() {
    return (
      this._g.cy
        .$()
        .map((x: any) => x.hidden())
        .filter((x: any) => x).length > 0
    );
  }

  markovClustering() {
    const opt = {
      attributes: [
        () => {
          return 1;
        },
      ],
    };

    let clusters = this._g.cy.$(":visible").markovClustering(opt);
    if (
      this._g.userPrefs.groupingOption.getValue() ==
      GroupingOptionTypes.compound
    ) {
      for (let i = 0; i < clusters.length; i++) {
        this.addParentNode(i);
        clusters[i].move({ parent: "c" + i });
      }
    } else {
      let arr = [];
      for (let i = 0; i < clusters.length; i++) {
        let a = [];
        for (let j = 0; j < clusters[i].length; j++) {
          a.push(clusters[i][j].id());
        }
        arr.push(a);
      }
      this._g.layout.clusters = arr;
    }
  }

  louvainClustering() {
    let clustering = this.louvainClusterer.cluster(this._g.cy.$(":visible"));
    let clusters = {};
    for (let n in clustering) {
      clusters[clustering[n]] = true;
    }
    if (
      this._g.userPrefs.groupingOption.getValue() ==
      GroupingOptionTypes.compound
    ) {
      // generate compound nodes
      for (let i in clusters) {
        this.addParentNode(i);
      }
      // add parents to non-compound nodes
      for (let n in clustering) {
        this._g.cy
          .elements(`[id = "${n}"]`)
          .move({ parent: "c" + clustering[n] });
      }
    } else {
      let arr = [];
      for (let i in clusters) {
        arr.push([]);
      }
      for (let i in clustering) {
        arr[clustering[i]].push(i);
      }
      this._g.layout.clusters = arr;
    }
  }

  deleteClusteringNodes() {
    this._g.cy.$().move({ parent: null });
    this._g.cy.remove("node." + C.CLUSTER_CLASS);
    this._g.layout.clusters = null;
  }

  expandAllCompounds() {
    if (this._g.cy.nodes("." + C.COLLAPSED_NODE_CLASS).length > 0) {
      this._g.expandCollapseApi.expandAll();
    }
  }

  bindComponentSelector() {
    let isSelectionLocked = false;

    this._g.cy.on("taphold", "node, edge", (e) => {
      if (!e.originalEvent.shiftKey) {
        return;
      }
      this.getVisibleComponentOf(e.target).select();
      // it selects current node again to prevent that, disable selection until next tap event
      this._g.cy.autounselectify(true);
      isSelectionLocked = true;
    });

    this._g.cy.on("tapend", "node, edge", () => {
      if (!isSelectionLocked) {
        return;
      }
      // wait to prevent unselect clicked node, after tapend
      setTimeout(() => {
        this._g.cy.autounselectify(false);
        isSelectionLocked = false;
      }, 100);
    });
  }

  private getVisibleComponentOf(e) {
    const comp = this._g.cy.collection();
    const visited = {};
    const stack = [];
    if (e.isNode()) {
      comp.merge(e);
      stack.push(e);
    } else {
      comp.merge(e);
      const conn = e.connectedNodes();
      comp.connectedNodes(conn);
      for (let i = 0; i < conn.length; i++) {
        stack.push(conn[i]);
      }
    }

    while (stack.length > 0) {
      const curr = stack.pop();
      visited[curr.id()] = true;
      const connEdges = curr.connectedEdges(":visible");
      const neigs = connEdges.union(connEdges.connectedNodes(":visible"));
      comp.merge(neigs);
      const neigNodes = neigs.nodes();
      for (let i = 0; i < neigNodes.length; i++) {
        if (!visited[neigNodes[i].id()]) {
          stack.push(neigNodes[i]);
        }
      }
    }

    return comp;
  }

  bindSelectObjOfThisType() {
    let isSelectionLocked = false;

    this._g.cy.on("taphold", "node, edge", (e) => {
      if (!e.originalEvent.ctrlKey) {
        return;
      }
      const model = this._g.dataModel.getValue();
      const classes = e.target.className();
      for (let c of classes) {
        if (model.nodes[c] || model.edges[c]) {
          this._g.cy.$("." + c).select();
        }
      }
      // it selects current node again to prevent that, disable selection until next tap event
      this._g.cy.autounselectify(true);
      isSelectionLocked = true;
    });

    this._g.cy.on("tapend", "node, edge", () => {
      if (!isSelectionLocked) {
        return;
      }
      // wait to prevent unselect clicked node, after tapend
      setTimeout(() => {
        this._g.cy.autounselectify(false);
        isSelectionLocked = false;
      }, 100);
    });
  }

  setRemovePoppersFn(fn: any) {
    this.removePopperFn = fn;
  }

  changeGroupingOption(x: GroupingOptionTypes) {
    if (
      x === GroupingOptionTypes.clusterId &&
      this._g.cy.$("." + C.CLUSTER_CLASS).length > 0
    ) {
      // expand all collapsed without animation (sync)
      this._g.expandCollapseApi.expandAll(C.EXPAND_COLLAPSE_FAST_OPT);
      const compounNodes = this._g.cy.$("." + C.CLUSTER_CLASS);
      const clusters: string[][] = [];
      for (let i = 0; i < compounNodes.length; i++) {
        const cluster = compounNodes[i]
          .children()
          .not("." + C.CLUSTER_CLASS)
          .map((x: any) => x.id());
        clusters.push(cluster);
      }
      this._g.layout.clusters = clusters;
      // delete the compound nodes
      this.removeGroup4Selected(
        this._g.cy.nodes("." + C.CLUSTER_CLASS),
        true,
        true
      );
    } else if (x === GroupingOptionTypes.compound) {
      // Clusters are always non-nested. If cise support nested clusters, below logic should be recursive
      if (!this._g.layout || !this._g.layout.clusters) {
        this._g.layout.clusters = null;
        return;
      }
      let i = 0;
      for (const cluster of this._g.layout.clusters) {
        const parentId = this.addParentNode(new Date().getTime() + "_" + i);
        for (const nodeId of cluster) {
          this._g.cy.nodes("#" + nodeId).move({ parent: parentId });
        }
        i++;
      }
      this._g.layout.clusters = null;
      this._g.performLayout(false);
    }
  }

  pathWalkNameTransform(name: string): string {
    return name.replace(/\$\$\$(\d+)\$\$\$/g, (match, charCode) => {
      return String.fromCharCode(Number(charCode));
    });
  }

  prepareAllNodesFastaData(nodes: any = this._g.cy.nodes()): string {
    let fastaData = "";
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].data("segmentData")) {
        fastaData +=
          ">" +
          nodes[i].data("segmentName") +
          "\n" +
          nodes[i].data("segmentData") +
          "\n";
      }
    }
    return fastaData;
  }
}
