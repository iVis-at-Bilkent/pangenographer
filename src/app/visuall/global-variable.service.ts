import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { BehaviorSubject } from "rxjs";
import appPreferences from "../../assets/appPreferences.json";
import {
  CLUSTER_CLASS,
  COLLAPSED_EDGE_CLASS,
  COLLAPSED_NODE_CLASS,
  CY_BATCH_END_DELAY,
  EXPAND_COLLAPSE_FAST_OPT,
  HIGHLIGHT_INDEX,
  HIGHLIGHT_OPACITY,
  LAYOUT_ANIMATION_DURATION,
  TYPES_NOT_TO_SHOW,
  debounce,
} from "./constants";
import { GraphElement, GraphHistoryItem } from "./db-service/data-types";
import { ErrorModalComponent } from "./popups/error-modal/error-modal.component";
import { GroupingOptionTypes, UserPreferences } from "./user-preference";

@Injectable({
  providedIn: "root",
})
export class GlobalVariableService {
  private HISTORY_SNAP_DELAY = 1500; // we should wait for layout to finish
  private _isSetEnums = false;
  private _isErrorModalUp = false;
  cy: any;
  viewUtils: any;
  layoutUtils: any;
  layout: {
    clusters: string[][];
    randomize: boolean;
    tile: boolean;
    animationDuration: number;
    tilingPaddingVertical: number;
    tilingPaddingHorizontal: number;
    idealEdgeLength: number;
    fit: boolean;
  };
  expandCollapseApi: any;
  hiddenClasses: Set<string>;
  setLoadingStatus: (boolean: boolean) => void;
  userPreferences: UserPreferences = {} as UserPreferences;
  userPreferencesFromFiles: UserPreferences = {} as UserPreferences;
  shownElementsChanged = new BehaviorSubject<boolean>(true);
  operationTabChanged = new BehaviorSubject<number>(1);
  isSwitch2ObjectTabOnSelect: boolean = true;
  graphHistory: GraphHistoryItem[] = [];
  showHideGraphHistory = new BehaviorSubject<boolean>(false);
  addNewGraphHistoryItem = new BehaviorSubject<boolean>(false);
  isLoadFromHistory: boolean = false;
  isLoadFromDB: boolean = false;
  isLoadFromExpandCollapse: boolean = false;
  isUserPrefReady = new BehaviorSubject<boolean>(false);
  statusMsg = new BehaviorSubject<string>("");
  performLayout: Function;
  cyNaviPositionSetter: any;
  appDescription = new BehaviorSubject<any>(null);
  dataModel = new BehaviorSubject<any>(null);
  enums = new BehaviorSubject<any>(null);
  // Below are for counting the number of nodes with zero indegree and outdegree nodes
  // that are brought by get some zero degree nodes option
  someZeroDegreeNodesCount = new BehaviorSubject<number>(0);
  cueUpdaters = {};
  constraints: {
    relativePlacementConstraints: any[];
    fixedNodeConstraints: any[];
  } = {
    relativePlacementConstraints: [],
    fixedNodeConstraints: [],
  };
  zeroIncomerAndOutgoerNodes: {
    source: any[];
    target: any[];
    sourceAndTarget: any[];
  } = {
    source: [],
    target: [],
    sourceAndTarget: [],
  };

  constructor(private _http: HttpClient, private _modalService: NgbModal) {
    this.hiddenClasses = new Set([]);
    // set user preferences staticly (necessary for rendering html initially)
    this.setUserPreferences(appPreferences, this.userPreferences);
    // set default values dynamically
    this._http.get("./assets/appPreferences.json").subscribe((x) => {
      this.setUserPreferences(x, this.userPreferences);
      this.setUserPreferences(x, this.userPreferencesFromFiles);

      // set user prefered values. These will be overriden if "Store User Profile" is checked
      this._http
        .get("/app/custom/config/app_description.json")
        .subscribe((x) => {
          this.appDescription.next(x);
          this.setUserPreferences(x["appPreferences"], this.userPreferences);
          this.setUserPreferences(
            x["appPreferences"],
            this.userPreferencesFromFiles
          );
          this.isUserPrefReady.next(true);
        }, this.showErr.bind(this));
    }, this.showErr.bind(this));

    let isGraphEmpty = () => {
      return this.cy.elements().not(":hidden, :transparent").length > 0;
    };

    this.performLayout = debounce(
      this.performLayoutFn,
      LAYOUT_ANIMATION_DURATION,
      false, // immediate call is not needed
      isGraphEmpty
    );

    // set cytoscape.js style dynamicly
    this._http.get("./assets/generated/stylesheet.json").subscribe((x) => {
      this.cy.style(x);
      this.addOtherStyles();
    }, this.showErr.bind(this));

    this._http.get("./assets/generated/properties.json").subscribe((x) => {
      this.dataModel.next(x);
    }, this.showErr.bind(this));

    this._http.get("/app/custom/config/enums.json").subscribe((x) => {
      this.enums.next(x);
    }, this.showErr.bind(this));
  }

  private showErr(e: any) {
    this.showErrorModal("Internet Error", e);
  }

  transfer2UserPreferences(u: any) {
    if (u) {
      this.setUserPreferences(u, this.userPreferences);
    }
  }

  runLayout(callback?: Function) {
    const elements4layout = this.cy.elements().not(":hidden, :transparent"); // also try this
    if (elements4layout.length < 1) {
      return;
    }

    if (this.layout.randomize) {
      this.statusMsg.next("Recalculating layout...");
    } else {
      this.statusMsg.next("Performing layout...");
    }

    this.setLoadingStatus(true);
    let layout: any;

    if (this.layout.clusters && this.layout.clusters.length > 0) {
      this.removeDeletedClusters();
      layout = elements4layout.layout(this.getCiseOptions());
    } else {
      layout = elements4layout.layout(this.layout);
    }

    layout.promiseOn("layoutstop", () => {
      callback();
    });

    layout.run();

    this.statusMsg.next("Rendering graph...");
  }

  private removeDeletedClusters() {
    const clusters = [];
    for (let i = 0; i < this.layout.clusters.length; i++) {
      const c = [];
      for (let j = 0; j < this.layout.clusters[i].length; j++) {
        if (this.cy.$id(this.layout.clusters[i][j]).length > 0) {
          c.push(this.layout.clusters[i][j]);
        }
      }
      if (c.length > 0) {
        clusters.push(c);
      }
    }
    this.layout.clusters = clusters;
  }

  switchLayoutRandomization(isRandomize: boolean) {
    this.layout.randomize = isRandomize;
    this.layoutUtils.setOption("randomize", isRandomize);
  }

  applyClassFiltering() {
    let hiddenSelector = "";
    for (let i of this.hiddenClasses) {
      hiddenSelector += "." + i + ",";
    }

    hiddenSelector = hiddenSelector.substr(0, hiddenSelector.length - 1);

    if (hiddenSelector.length > 1) {
      this.viewUtils.hide(this.cy.$(hiddenSelector));
    }

    this.handleCompoundsOnHideDelete();
  }

  removeHighlights(elements?: any) {
    elements = elements || this.cy.elements();
    if (this.userPreferences.isHighlightInZeroOutZero.getValue()) {
      elements.forEach((element: any) => {
        if (
          this.zeroIncomerAndOutgoerNodes.source.indexOf(element) < 0 &&
          this.zeroIncomerAndOutgoerNodes.target.indexOf(element) < 0 &&
          this.zeroIncomerAndOutgoerNodes.sourceAndTarget.indexOf(element) < 0
        ) {
          this.viewUtils.removeHighlights(element);
        }
      });
    } else {
      this.viewUtils.removeHighlights(elements);
    }
  }

  highlightElements(elements: any, index?: number) {
    if (this.userPreferences.isHighlightInZeroOutZero.getValue()) {
      elements.forEach((element: any) => {
        if (
          this.zeroIncomerAndOutgoerNodes.source.indexOf(element) < 0 &&
          this.zeroIncomerAndOutgoerNodes.target.indexOf(element) < 0 &&
          this.zeroIncomerAndOutgoerNodes.sourceAndTarget.indexOf(element) < 0
        ) {
          this.viewUtils.highlight(
            element,
            index ? index : this.userPreferences.currHighlightIdx.getValue()
          );
        }
      });
    } else {
      this.viewUtils.highlight(
        elements,
        index ? index : this.userPreferences.currHighlightIdx.getValue()
      );
    }
  }

  hideTypesNotToShow() {
    TYPES_NOT_TO_SHOW.forEach((type) => {
      this.viewUtils.hide(this.cy.$("." + type));
    });
  }

  filterByClass(elements: any) {
    let hiddenSelector = "";
    for (let i of this.hiddenClasses) {
      hiddenSelector += "." + i + ",";
    }

    hiddenSelector = hiddenSelector.substr(0, hiddenSelector.length - 1);

    if (hiddenSelector.length < 1) {
      return elements;
    }
    return elements.not(hiddenSelector);
  }

  getGraphElementSet() {
    return new Set<string>(this.cy.elements().map((x: any) => x.id()));
  }

  updateSelectionCyStyle() {
    this.cy
      .style()
      .selector(":selected")
      .style({
        "overlay-color": this.userPreferences.selectionColor.getValue(),
        "overlay-padding": this.userPreferences.selectionWidth.getValue(),
        "target-arrow-color": "gray",
        "source-arrow-color": "gray",
      })
      .selector("edge:selected")
      .style({
        "overlay-padding": (e: any) => {
          return (
            (this.userPreferences.selectionWidth.getValue() + e.width()) / 2 +
            "px"
          );
        },
      })
      .update();
    this.addStyle4Emphasize();
  }

  add2GraphHistory(expo: string) {
    setTimeout(() => {
      if (
        this.graphHistory.length >
        this.userPreferences.queryHistoryLimit.getValue() - 1
      ) {
        this.graphHistory.splice(0, 1);
      }
      const options = { bg: "white", scale: 1, full: true };
      const base64png: string = this.cy.png(options);
      const elements = this.cy.json().elements;

      let g: GraphHistoryItem = {
        expo: expo,
        base64png: base64png,
        json: elements,
      };
      this.graphHistory.push(g);
      this.addNewGraphHistoryItem.next(true);
    }, this.HISTORY_SNAP_DELAY);
  }

  translateVariableNames2Labels(variables: string[]): string[] {
    let labels = [];
    for (let i = 0; i < variables.length; i++) {
      // --- GFA segment variables ---
      if (variables[i] === "segmentName") {
        labels.push("Segment Name");
      } else if (variables[i] === "segmentLength") {
        labels.push("Segment Length");
      } else if (variables[i] === "segmentData") {
        labels.push("Segment Data");
      }
      // link
      else if (variables[i] === "kmerCount") {
        labels.push("Kmer Count");
      }
      // link
      else if (variables[i] === "fragmentCount") {
        labels.push("Fragment Count");
      }
      // containment, link
      else if (variables[i] === "readCount") {
        labels.push("Read Count");
      } else if (variables[i] === "SHA256Checksum") {
        labels.push("SHA256 Checksum");
      } else if (variables[i] === "URIorLocalSystemPath") {
        labels.push("URI or Local System Path");
      }
      // link, jump
      else if (variables[i] === "pathNames") {
        labels.push("Path Names");
      }
      // link
      else if (variables[i] === "walkSampleIdentifiers") {
        labels.push("Walk Sample Identifiers");
      }

      // --- GFA link variables ---
      else if (variables[i] === "overlap") {
        labels.push("Overlap");
      }
      // jump, containment
      else if (variables[i] === "sourceOrientation") {
        labels.push("Source Orientation");
      }
      // jump, containment
      else if (variables[i] === "targetOrientation") {
        labels.push("Target Orientation");
      }
      // containment
      else if (variables[i] === "edgeIdentifier") {
        labels.push("Edge Identifier");
      } else if (variables[i] === "mappingQuality") {
        labels.push("Mapping Quality");
      }
      // containment
      else if (variables[i] === "numberOfMismatchesOrGaps") {
        labels.push("Number of Mismatches or Gaps");
      }
      // jump, containment
      else if (variables[i] === "sequenceLength") {
        labels.push("Sequence Length");
      }

      // --- GFA jump variables ---
      else if (variables[i] === "distance") {
        labels.push("Distance");
      } else if (variables[i] === "indirectShortcutConnections") {
        labels.push("Indirect Shortcut Connections");
      } else if (variables[i] === "directShortcutConnections") {
        labels.push("Direct Shortcut Connections");
      }
      // GFA containment variables
      else if (variables[i] === "pos") {
        labels.push("Pos");
      }
    }
    return labels;
  }

  getLabels4Elements(
    elementIds: string[],
    isNode: boolean = true,
    objectDatas: GraphElement[] = null
  ): string {
    return this.getLabels4ElementsAsArray(elementIds, isNode, objectDatas).join(
      ","
    );
  }

  getLabels4ElementsAsArray(
    elementIds: string[],
    isNode: boolean = true,
    objectDatas: GraphElement[] = null
  ): string[] {
    let cyIds: string[] = [];
    let idChar = "n";
    if (!isNode) {
      idChar = "e";
    }
    if (objectDatas) {
      cyIds = objectDatas.map((x) => x.data.id);
    } else {
      for (let i = 0; i < elementIds.length; i++) {
        cyIds.push(idChar + elementIds[i]);
      }
    }

    const labels = [];
    let labelParent: any = this.appDescription.getValue().objects;
    if (!isNode) {
      labelParent = this.appDescription.getValue().relations;
    }
    for (let i = 0; i < cyIds.length; i++) {
      let className = "";
      if (!objectDatas) {
        className = this.cy.elements(`[id = "${cyIds[i]}"]`).className()[0];
      } else {
        className = objectDatas[i].classes.split(" ")[0];
      }

      let s = labelParent[className]["style"]["label"] as string;
      if (s.indexOf("(") < 0) {
        labels.push(s);
      } else {
        let propertyName = s.slice(s.indexOf("(") + 1, s.indexOf(")"));
        if (!objectDatas) {
          labels.push(
            this.cy.elements(`[id = "${cyIds[i]}"]`).data(propertyName)
          );
        } else {
          const currentData = objectDatas[i].data;
          let l = currentData[propertyName];
          if (!l) {
            l = currentData[Object.keys(currentData)[0]];
          }
          labels.push(l);
        }
      }
    }

    return labels;
  }

  listen4graphEvents() {
    this.cy.on("layoutstop", () => {
      this.setLoadingStatus(false);
      this.statusMsg.next("Layout is done.");

      setTimeout(() => {
        this.statusMsg.next("");
      }, 2000);
    });
  }

  getFcoseOptions() {
    let p = 4;
    if (this.userPreferencesFromFiles.tilingPadding) {
      p = this.userPreferencesFromFiles.tilingPadding.getValue();
    }
    return {
      name: "fcose",
      randomize: false,
      // whether or not to animate the layout
      animate: true,
      // duration of animation in ms, if enabled
      animationDuration: LAYOUT_ANIMATION_DURATION,
      fit: !this.userPreferences.isAutoIncrementalLayoutOnChange.getValue(),
      // padding around layout
      padding: 10,
      // whether to include labels in node dimensions. Valid in 'proof' quality
      nodeDimensionsIncludeLabels: true,
      tile: true,
      // Represents the amount of the vertical space to put between the zero degree members during the tiling operation(can also be a function)
      tilingPaddingVertical: p,
      // Represents the amount of the horizontal space to put between the zero degree members during the tiling operation(can also be a function)
      tilingPaddingHorizontal: p,
      idealEdgeLength: 50,
      clusters: null, // cise argument
      relativePlacementConstraint:
        this.constraints.relativePlacementConstraints,
      fixedNodeConstraint: this.constraints.fixedNodeConstraints,
    };
  }

  changeHighlightInZeroOutZero() {
    this.cy.startBatch();

    if (this.zeroIncomerAndOutgoerNodes.source) {
      this.zeroIncomerAndOutgoerNodes.source.forEach((x) => {
        this.viewUtils.removeHighlights(x);
      });
    }
    if (this.zeroIncomerAndOutgoerNodes.target) {
      this.zeroIncomerAndOutgoerNodes.target.forEach((x) => {
        this.viewUtils.removeHighlights(x);
      });
    }

    this.zeroIncomerAndOutgoerNodes = {
      source: [],
      target: [],
      sourceAndTarget: [],
    };

    this.cy.nodes(":visible").forEach((x: any) => {
      if (x.incomers().length === 0 && x.outgoers().length > 0) {
        this.zeroIncomerAndOutgoerNodes.source.push(x);
        if (this.userPreferences.isHighlightInZeroOutZero.getValue()) {
          this.viewUtils.highlight(x, HIGHLIGHT_INDEX.zeroIndegree); // highlight source nodes
        }
      } else if (x.outgoers().length === 0 && x.incomers().length > 0) {
        this.zeroIncomerAndOutgoerNodes.target.push(x);
        if (this.userPreferences.isHighlightInZeroOutZero.getValue()) {
          this.viewUtils.highlight(x, HIGHLIGHT_INDEX.zeroOutdegree); // highlight target nodes
        }
      }
    });

    setTimeout(() => {
      this.cy.endBatch();
    }, CY_BATCH_END_DELAY);
  }

  prepareConstraints() {
    this.changeHighlightInZeroOutZero();
    let longestPath = -1;

    let sourceShortests = {};
    let targetShortests = {};

    if (
      this.zeroIncomerAndOutgoerNodes.source.length &&
      this.zeroIncomerAndOutgoerNodes.source.length
    ) {
      this.zeroIncomerAndOutgoerNodes.source.forEach((source) => {
        let dijkstra = this.cy.elements().dijkstra({
          root: source,
          directed: true,
        });
        this.zeroIncomerAndOutgoerNodes.target.forEach((target) => {
          let dist = dijkstra.distanceTo(target);
          sourceShortests[source.id()] = Math.min(
            sourceShortests[source.id()] || Infinity,
            dist
          );
          targetShortests[target.id()] = Math.min(
            targetShortests[target.id()] || Infinity,
            dist
          );
        });
      });
    }

    for (const key in sourceShortests) {
      longestPath = Math.max(longestPath, sourceShortests[key]);
    }
    for (const key in targetShortests) {
      longestPath = Math.max(longestPath, targetShortests[key]);
    }

    let halfOfIdealEdgeLength = 43;

    for (let i = 0; i <= longestPath; i++) {
      this.cy.add({
        group: "nodes",
        data: { id: "PSEUDOSOURCENODE" + i },
        position: { x: i * halfOfIdealEdgeLength, y: 0 },
        classes: "PSEUDO",
      });

      this.cy.add({
        group: "nodes",
        data: { id: "PSEUDOTARGETNODE" + i },
        position: { x: (longestPath * 2 - i) * halfOfIdealEdgeLength, y: 0 },
        classes: "PSEUDO",
      });

      this.constraints.fixedNodeConstraints.push({
        nodeId: "PSEUDOSOURCENODE" + i,
        position: { x: i * halfOfIdealEdgeLength, y: 0 },
      });

      this.constraints.fixedNodeConstraints.push({
        nodeId: "PSEUDOTARGETNODE" + i,
        position: { x: (longestPath * 2 - i) * halfOfIdealEdgeLength, y: 0 },
      });
    }

    this.cy
      .filter(".PSEUDO")
      .nodes()
      .forEach((n: any) => {
        n.style("background-color", "white");
        n.style("width", longestPath + "px");
        n.style("height", longestPath + "px");
      });

    if (
      this.zeroIncomerAndOutgoerNodes.source.length &&
      this.zeroIncomerAndOutgoerNodes.target.length
    ) {
      this.zeroIncomerAndOutgoerNodes.source.forEach((n) => {
        this.constraints.relativePlacementConstraints.push({
          left: n.id(),
          right:
            "PSEUDOSOURCENODE" + (longestPath - sourceShortests[n.id()] + 1),
          gap: halfOfIdealEdgeLength * 2,
        });
      });
      this.zeroIncomerAndOutgoerNodes.target.forEach((n) => {
        this.constraints.relativePlacementConstraints.push({
          left:
            "PSEUDOTARGETNODE" + (longestPath - targetShortests[n.id()] + 1),
          right: n.id(),
          gap: halfOfIdealEdgeLength * 2,
        });
      });
    }
  }

  // remove constraints and pseudo nodes after layout is done
  // if dontFit is then don't fit the graph to the viewport
  removeConstraints(dontFit: boolean = false) {
    // remove pseudo nodes
    this.cy.remove("node[id^='PSEUDOSOURCENODE']");
    this.cy.remove("node[id^='PSEUDOTARGETNODE']");

    // reset constraints after layout is done
    this.constraints = {
      relativePlacementConstraints: [],
      fixedNodeConstraints: [],
    };

    // fit the graph to the viewport after layout is done if dontFit is false
    setTimeout(() => {
      if (!dontFit) {
        this.cy.fit();
      }
    }, CY_BATCH_END_DELAY);
  }

  // delete/expand compounds if they don't have any visible elements
  handleCompoundsOnHideDelete() {
    const metaEdges = this.cy.edges("." + COLLAPSED_EDGE_CLASS);
    // some collapsed edges should be expanded, or their data should be updated
    for (let i = 0; i < metaEdges.length; i++) {
      const collapsedEdges = metaEdges[i].data("collapsedEdges");
      if (collapsedEdges.filter(":visible").length < 2) {
        this.expandCollapseApi.expandEdges(metaEdges[i]);
      } else {
        metaEdges[i].data("collapsedEdges", collapsedEdges.filter(":visible"));
        this.cy.add(collapsedEdges.not(":visible"));
      }
    }

    const metaNodes = this.cy.nodes("." + COLLAPSED_NODE_CLASS);
    // First, expand the collapsed if they don't have anything visible inside
    for (let i = 0; i < metaNodes.length; i++) {
      const collapsedChildren = metaNodes[i].data("collapsedChildren");
      if (collapsedChildren.filter(":visible").length < 1) {
        this.expandCollapseApi.expand(metaNodes[i], EXPAND_COLLAPSE_FAST_OPT);
      }
    }

    //if an expanded compound does not have anything visible, delete it
    const clusterNodes = this.cy
      .nodes("." + CLUSTER_CLASS)
      .not("." + COLLAPSED_NODE_CLASS);
    for (let i = 0; i < clusterNodes.length; i++) {
      // if there are empty compounds, delete them
      const children = clusterNodes[i].children();
      if (children.filter(":visible").length < 1) {
        children.move({ parent: null });
        this.cy.remove(clusterNodes[i]);
      }
    }
  }

  getEnumMapping(): any {
    // changes value inside `this.appDescription.getValue().enumMapping` since it works on reference
    const mapping = this.appDescription.getValue().enumMapping;
    if (this._isSetEnums) {
      return mapping;
    }
    const enums = this.enums.getValue();
    for (const k in mapping) {
      for (const k2 in mapping[k]) {
        mapping[k][k2] = enums[mapping[k][k2]];
      }
    }
    this._isSetEnums = true;
    return mapping;
  }

  showErrorModal(title: string, msg: string) {
    if (this._isErrorModalUp) {
      return;
    }
    this._isErrorModalUp = true;
    const fn = () => {
      this._isErrorModalUp = false;
    };
    const instance = this._modalService.open(ErrorModalComponent);
    instance.result.then(fn, fn);
    instance.componentInstance.title = title;
    instance.componentInstance.msg = msg;
  }

  /**
   * @param  {} fn should be a function that takes a cytoscape.js element and returns true or false
   */
  filterRemovedElements(fn: any) {
    const r = this.cy.collection();
    const collapsedNodes = this.cy.nodes("." + COLLAPSED_NODE_CLASS);
    for (let i = 0; i < collapsedNodes.length; i++) {
      const ancestors = this.cy.collection();
      this.filterOnElement(collapsedNodes[i], fn, r, ancestors);
    }
    const collapsedEdges = this.cy.edges("." + COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < collapsedEdges.length; i++) {
      const ancestors = this.cy.collection();
      this.filterOnElement(collapsedEdges[i], fn, r, ancestors);
    }
    return r;
  }

  filterOnElement(element: any, fn: any, r: any, ancestors: any) {
    const collapsedChildren = element.data("collapsedChildren");
    const collapsedEdges = element.data("collapsedEdges");
    let collapsed = this.cy.collection();
    if (collapsedChildren) {
      collapsed.merge(collapsedChildren);
    }
    if (collapsedEdges) {
      collapsed.merge(collapsedEdges);
    }
    if (!collapsedChildren && !collapsedEdges && fn(element)) {
      r.merge(element);
      r.merge(ancestors);
    }

    if (collapsed.length > 0) {
      ancestors = ancestors.union(element);
    }
    for (let i = 0; i < collapsed.length; i++) {
      this.filterOnElement(collapsed[i], fn, r, ancestors);
    }
  }

  private performLayoutFn(
    isRandomize: boolean,
    isDirectCommand: boolean = false,
    animationDuration: number = LAYOUT_ANIMATION_DURATION,
    dontFit: boolean = false
  ) {
    if (
      !this.userPreferences.isAutoIncrementalLayoutOnChange.getValue() &&
      !isRandomize &&
      !isDirectCommand
    ) {
      this.cy.fit();
      return;
    }

    if (
      this.userPreferences.groupingOption.getValue() !=
      GroupingOptionTypes.clusterId
    ) {
      this.prepareConstraints();
      this.layout = this.getFcoseOptions();
    }

    this.layout.animationDuration = animationDuration;
    this.layout.tile =
      this.userPreferences.isTileDisconnectedOnLayout.getValue();
    this.switchLayoutRandomization(isRandomize);

    // if dontFit is true, then don't fit the graph to the viewport
    this.layout.fit = this.layout.fit && !dontFit;

    this.runLayout(() => {
      this.removeConstraints(dontFit); // remove constraints after layout is done
    });
  }

  private getCiseOptions() {
    return {
      // -------- Mandatory parameters --------
      name: "cise",

      // ClusterInfo can be a 2D array contaning node id's or a function that returns cluster ids.
      // For the 2D array option, the index of the array indicates the cluster ID for all elements in
      // the collection at that index. Unclustered nodes must NOT be present in this array of clusters.
      //
      // For the function, it would be given a Cytoscape node and it is expected to return a cluster id
      // corresponding to that node. Returning negative numbers, null or undefined is fine for unclustered
      // nodes.
      // e.g
      // Array:                                     OR          function(node){
      //  [ ['n1','n2','n3'],                                       ...
      //    ['n5','n6']                                         }
      //    ['n7', 'n8', 'n9', 'n10'] ]
      clusters: this.layout.clusters,
      randomize: this.layout.randomize,

      // -------- Optional parameters --------
      // Whether to animate the layout
      // - true : Animate while the layout is running
      // - false : Just show the end result
      // - 'end' : Animate directly to the end result
      animate: "end",

      // number of ticks per frame; higher is faster but more jerky
      refresh: 10,

      // Animation duration used for animate:'end'
      animationDuration: LAYOUT_ANIMATION_DURATION,

      // Easing for animate:'end'
      animationEasing: undefined,

      // Whether to fit the viewport to the repositioned graph
      // true : Fits at end of layout for animate:false or animate:'end'
      fit: !this.userPreferences.isAutoIncrementalLayoutOnChange.getValue(),

      // Padding in rendered co-ordinates around the layout
      padding: 30,

      // separation amount between nodes in a cluster
      // note: increasing this amount will also increase the simulation time
      nodeSeparation: 10,

      // Inter-cluster edge length factor
      // (2.0 means inter-cluster edges should be twice as long as intra-cluster edges)
      idealInterClusterEdgeLengthCoefficient: 1.4,

      // Whether to pull on-circle nodes inside of the circle
      allowNodesInsideCircle: true,

      // Max percentage of the nodes in a circle that can move inside the circle
      maxRatioOfNodesInsideCircle: 0.1,

      // - Lower values give looser springs
      // - Higher values give tighter springs
      springCoeff: 0.45,

      // Node repulsion (non overlapping) multiplier
      nodeRepulsion: 4500,

      // Gravity force (constant)
      gravity: 0.25,

      // Gravity range (constant)
      gravityRange: 3.8,

      packComponents: true,

      // Layout event callbacks; equivalent to `layout.one('layoutready', callback)` for example
      ready: function () {}, // on layoutready
      stop: function () {}, // on layoutstop
    };
  }

  private setUserPreferences(object: any, userPreferences: any) {
    if (object === undefined || object === null) {
      return;
    }
    for (let k in object) {
      let property = object[k];
      let propType = typeof property;
      if (
        propType == "string" ||
        propType == "number" ||
        propType == "boolean"
      ) {
        if (userPreferences[k]) {
          (userPreferences[k] as BehaviorSubject<any>).next(property);
        } else {
          userPreferences[k] = new BehaviorSubject(property);
        }
      } else {
        if (!userPreferences[k]) {
          if (property instanceof Array) {
            userPreferences[k] = [];
          } else {
            userPreferences[k] = {};
          }
        }
        this.setUserPreferences(object[k], userPreferences[k]);
      }
    }
  }

  // some styles uses functions, so they can't be added using JSON
  private addOtherStyles() {
    this.cy.startBatch();
    this.cy
      .style()
      .selector("edge." + COLLAPSED_EDGE_CLASS)
      .style({
        label: (e: any) => {
          return "(" + e.data("collapsedEdges").length + ")";
        },
        width: (e: any) => {
          let n = e.data("collapsedEdges").length;
          return 3 + Math.log2(n) + "px";
        },
        "line-color": this.setColor4CompoundEdge.bind(this),
        "target-arrow-color": this.setColor4CompoundEdge.bind(this),
        "target-arrow-shape": this.setTargetArrowShape.bind(this),
      })
      .update();

    // add override styles
    this.cy
      .style()
      .selector("node.ellipsis_label")
      .style({
        "text-wrap": "wrap",
        label: "data(__label__)",
      })
      .selector("edge.nolabel")
      .style({
        label: "",
      })
      .update();

    function arrowShape(orientation: string, isTarget: boolean) {
      if (isTarget) {
        if (orientation === "forward") {
          return "triangle";
        }
        return "triangle-tee";
      } else {
        if (orientation === "forward") {
          return "none";
        }
        return "tee";
      }
    }

    this.cy
      .style()
      .selector("edge.LINK")
      .style({
        "target-arrow-shape": function (e: any) {
          return arrowShape(e.data("targetOrientation"), true);
        },
        "source-arrow-shape": function (e: any) {
          return arrowShape(e.data("sourceOrientation"), false);
        },
      })
      .update();

    this.cy
      .style()
      .selector("edge.JUMP")
      .style({
        "target-arrow-shape": function (e: any) {
          return arrowShape(e.data("targetOrientation"), true);
        },
        "source-arrow-shape": function (e: any) {
          return arrowShape(e.data("sourceOrientation"), false);
        },
      })
      .update();

    this.cy
      .style()
      .selector("edge.CONTAINMENT")
      .style({
        "target-arrow-shape": function (e: any) {
          return arrowShape(e.data("targetOrientation"), true);
        },
        "source-arrow-shape": function (e: any) {
          return arrowShape(e.data("sourceOrientation"), false);
        },
      })
      .update();

    setTimeout(() => {
      this.cy.endBatch();
    }, CY_BATCH_END_DELAY);
  }

  private addStyle4Emphasize() {
    const color = "#da14ff";
    const wid = this.userPreferences.highlightStyles[0].wid.getValue();
    const OPACITY_DIFF = 0.05;

    this.cy
      .style()
      .selector("node.emphasize")
      .style({
        "underlay-color": color,
        "underlay-opacity": HIGHLIGHT_OPACITY + OPACITY_DIFF,
        "underlay-padding": wid,
      })
      .update();

    this.cy
      .style()
      .selector("edge.emphasize")
      .style({
        "underlay-color": color,
        "underlay-opacity": HIGHLIGHT_OPACITY + OPACITY_DIFF,
        "underlay-padding": (e: any) => {
          return (wid + e.width()) / 2 + "px";
        },
      })
      .update();
  }

  private setColor4CompoundEdge(e: any) {
    let collapsedEdges = e.data("collapsedEdges");
    if (this.doElementsMultiClasses(collapsedEdges)) {
      return "#b3b3b3";
    }
    return collapsedEdges[0].style("line-color");
  }

  private setTargetArrowShape(e: any) {
    let collapsedEdges = e.data("collapsedEdges");
    if (this.doElementsMultiClasses(collapsedEdges)) {
      return "triangle";
    }
    return collapsedEdges[0].style("target-arrow-shape");
  }

  private doElementsMultiClasses(elements: any) {
    let classDictionary = {};
    for (let i = 0; i < elements.length; i++) {
      let classes = elements[i].classes();
      for (let j = 0; j < classes.length; j++) {
        classDictionary[classes[j]] = true;
      }
    }
    return Object.keys(classDictionary).length > 1;
  }

  // Move all the elements to the right by 0.000001
  // and then move them back to the original position
  // This is done to force the cues to be updated
  refreshCuesBadges() {
    this.cy.panBy({ x: 0.000001, y: 0.000001 });
    this.cy.panBy({ x: -0.000001, y: -0.000001 });

    this.cy.zoom(this.cy.zoom() + 0.00001);
    this.cy.zoom(this.cy.zoom() - 0.00001);

    // Move the nodes to the right individually by 0.000001
    // and then move them back to the original position
    this.cy.nodes().forEach((node: any) => {
      node.position("x", node.position("x") + 0.000001);
      node.position("x", node.position("x") - 0.000001);
    });
  }
}
