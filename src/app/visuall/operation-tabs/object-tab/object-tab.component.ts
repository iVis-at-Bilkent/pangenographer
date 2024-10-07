import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subject, Subscription } from "rxjs";
import {
  TableData,
  TableFiltering,
  TableViewInput,
  filterTableDatas,
  translateColumnNamesAndProperties,
} from "../../../shared/table-view/table-view-types";
import {
  CLUSTER_CLASS,
  COLLAPSED_EDGE_CLASS,
  OBJ_INFO_UPDATE_DELAY,
  TYPES_NOT_TO_SHOW,
  debounce,
  getPropNamesFromObject,
} from "../../constants";
import { CytoscapeService } from "../../cytoscape.service";
import { DbAdapterService } from "../../db-service/db-adapter.service";
import { GlobalVariableService } from "../../global-variable.service";
import { SequenceDataService } from "../../sequence-data.service";

@Component({
  selector: "app-object-tab",
  templateUrl: "./object-tab.component.html",
  styleUrls: ["./object-tab.component.css"],
})
export class ObjectTabComponent implements OnInit, OnDestroy {
  nodeClasses: Set<string>;
  edgeClasses: Set<string>;
  selectedClasses: string;
  selectedItemProperties: any;
  tableFilled = new Subject<boolean>();
  multiObjectTableFilled = new Subject<boolean>();
  clearMultiObjectTableFilter = new Subject<boolean>();
  isShowStatsTable: boolean = false;
  isShowObjectTable: boolean = false;
  highlightedPathWalk: string = "";

  tableInput: TableViewInput = {
    columns: ["Type", "Count", "Selected", "Hidden"],
    isHide0: true,
    results: [],
    resultCount: 0,
    currentPage: 1,
    pageSize: 20,
    tableTitle: "Statistics",
    isShowExportAsCSV: true,
    isLoadGraph: true,
    columnLimit: 5,
    isMergeGraph: false,
    isNodeData: false,
    isUseCySelector4Highlight: true,
    isHideLoadGraph: true,
    allChecked: false,
  };

  multipleObjectTableInput: TableViewInput = {
    columns: ["Type"],
    isHide0: true,
    results: [],
    resultCount: 0,
    currentPage: 1,
    pageSize: 20,
    isReplace_inHeaders: true,
    tableTitle: "Properties",
    isShowExportAsCSV: true,
    isEmphasizeOnHover: true,
    isLoadGraph: true,
    isMergeGraph: false,
    isNodeData: false,
    isUseCySelector4Highlight: true,
    isHideLoadGraph: true,
    allChecked: false,
  };

  private NODE_TYPE = "_NODE_";
  private EDGE_TYPE = "_EDGE_";
  shownElementsSubscription: Subscription;
  appDescSubscription: Subscription;
  dataModelSubscription: Subscription;

  constructor(
    private _g: GlobalVariableService,
    private _dbService: DbAdapterService,
    private _cyService: CytoscapeService,
    private _sequenceDataService: SequenceDataService
  ) {
    this.selectedItemProperties = {};
  }

  ngOnInit() {
    this.appDescSubscription = this._g.appDescription.subscribe((x) => {
      if (x === null) {
        return;
      }
      this.dataModelSubscription = this._g.dataModel.subscribe((x2) => {
        if (x2 === null) {
          return;
        }
        x2.edges = x2.edges;
        this.nodeClasses = new Set([]);
        this.edgeClasses = new Set([]);
        for (const key in x2.nodes) {
          this.nodeClasses.add(key);
        }

        for (const key in x2.edges) {
          this.edgeClasses.add(key);
        }

        this.shownElementsSubscription = this._g.shownElementsChanged.subscribe(
          () => {
            this.showStats();
          }
        );
        this.showObjectProperties();
        this.showStats();
        this._cyService.showObjPropsFn = debounce(
          this.showObjectProperties,
          OBJ_INFO_UPDATE_DELAY
        ).bind(this);
        this._cyService.showStatsFn = debounce(
          this.showStats,
          OBJ_INFO_UPDATE_DELAY
        ).bind(this);
      });
    });
  }

  ngOnDestroy(): void {
    if (this.appDescSubscription) {
      this.appDescSubscription.unsubscribe();
    }
    if (this.dataModelSubscription) {
      this.dataModelSubscription.unsubscribe();
    }
    if (this.shownElementsSubscription) {
      this.shownElementsSubscription.unsubscribe();
    }
  }

  showObjectProperties() {
    let selected = this._g.cy.$(":selected");
    this.isShowObjectTable = false;

    // If the selected element is a collapsed edge, then show the properties of the collapsed edge
    if (selected.filter("." + COLLAPSED_EDGE_CLASS).length > 0) {
      this.isShowObjectTable = true;
      this.showCompoundEdgeProperties(true);
      return;
    }

    // If the selected elements are nodes or edges, then show the properties of the selected elements
    if (
      selected.length > 1 &&
      (selected.length == selected.filter("node").length ||
        selected.length == selected.filter("edge").length)
    ) {
      this.isShowObjectTable = true;
      this.showMultipleObjectTable(true);
      return;
    }

    // If the selected element is a node, then show the properties of the selected node
    const selectedNonMeta = selected.not("." + COLLAPSED_EDGE_CLASS);
    let props: { [x: string]: any }, classNames: any[];

    [props, classNames] = this.getCommonObjectProperties(selectedNonMeta);
    const properties = this._g.dataModel.getValue();
    // remove undefined but somehow added properties (cuz of extensions)
    let definedProperties = getPropNamesFromObject(
      [properties.nodes, properties.edges],
      false
    );
    for (let k in props) {
      if (!definedProperties.has(k)) {
        delete props[k];
      }
    }

    // remove classes added from extensions and other stuff
    classNames = classNames.filter(
      (x) => this.nodeClasses.has(x) || this.edgeClasses.has(x)
    );
    this.renderObjectProps(props, classNames, selectedNonMeta.length);
  }

  findTypeOfAttribute(key: string): string {
    const properties = this._g.dataModel.getValue();
    for (const nodeClass in properties.nodes) {
      if (properties.nodes[nodeClass].hasOwnProperty(key))
        return properties.nodes[nodeClass][key];
    }
    for (const edgeClass in properties.edges) {
      if (properties.edges[edgeClass].hasOwnProperty(key))
        return properties.edges[edgeClass][key];
    }
  }

  showCompoundEdgeProperties(isNeed2Filter: boolean) {
    const compoundEdges = this._g.cy
      .edges(":selected")
      .filter("." + COLLAPSED_EDGE_CLASS);
    const selectedNodeCnt = this._g.cy.nodes(":selected").length;
    this.selectedClasses = "";
    this.selectedItemProperties = {};
    if (compoundEdges.length < 1 || selectedNodeCnt > 0) {
      return;
    }
    let idMappingForHighlight = {};
    let edges = this._g.cy.collection();
    for (let i = 0; i < compoundEdges.length; i++) {
      let collapsed = compoundEdges[i].data("collapsedEdges");
      edges = edges.union(collapsed);
      for (let j = 0; j < collapsed.length; j++) {
        idMappingForHighlight[collapsed[j].id()] = compoundEdges[i].id();
      }
    }
    let stdSelectedEdges = this._g.cy
      .edges(":selected")
      .not("." + COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < stdSelectedEdges.length; i++) {
      idMappingForHighlight[stdSelectedEdges[i].id()] =
        stdSelectedEdges[i].id();
    }
    edges = edges.union(stdSelectedEdges);
    this.fillMultiObjectTable(
      edges,
      false,
      idMappingForHighlight,
      isNeed2Filter
    );
  }

  private fillMultiObjectTable(
    elements: any,
    isNode: boolean,
    idMappingForHighlight: any,
    isNeed2Filter: boolean
  ) {
    this.multipleObjectTableInput.isNodeData = isNode;
    const elementTypesArray = elements.map((x: any) => x.classes()[0]);
    let elementTypes = {};

    for (let i = 0; i < elementTypesArray.length; i++) {
      elementTypes[elementTypesArray[i]] = true;
    }

    const properties = this._g.dataModel.getValue();
    let definedProperties = {};

    for (let type in elementTypes) {
      if (isNode) {
        for (let j in properties.nodes[type]) {
          definedProperties[j] = true;
        }
      } else {
        for (let j in properties.edges[type]) {
          definedProperties[j] = true;
        }
      }
    }

    this.multipleObjectTableInput.columns = ["Type"].concat(
      translateColumnNamesAndProperties(Object.keys(definedProperties))
    );
    this.multipleObjectTableInput.results = [];
    this.multipleObjectTableInput.classNames = [];
    let elementTypeCount = {};

    for (let i = 0; i < elements.length; i++) {
      let className = elements[i].classes()[0];

      elementTypeCount[className] = elementTypeCount[className]
        ? elementTypeCount[className] + 1
        : 1;

      let row: TableData[] = [
        {
          value: "#" + idMappingForHighlight[elements[i].id()],
        },
        { value: className },
      ];

      for (let j in definedProperties) {
        if (elements[i].data(j)) {
          row.push({
            value: elements[i].data(j),
          });
        }
      }

      this.multipleObjectTableInput.results.push(row);
      this.multipleObjectTableInput.classNames.push(className);
    }

    for (let k in elementTypeCount) {
      this.selectedClasses += k + "(" + elementTypeCount[k] + ") ";
    }

    this.multipleObjectTableInput.pageSize =
      this._g.userPreferences.dataPageSize.getValue();
    this.multipleObjectTableInput.currentPage = 1;

    // if too many edges need to be shown, we should make pagination
    if (isNeed2Filter) {
      this.clearMultiObjectTableFilter.next(true);
      filterTableDatas(
        { orderBy: "", orderDirection: "", txt: "" },
        this.multipleObjectTableInput,
        this._g.userPreferences.isIgnoreCaseInText.getValue()
      );
    }

    setTimeout(() => {
      this.multiObjectTableFilled.next(true);
    }, 100);
  }

  showMultipleObjectTable(isNeed2Filter: boolean) {
    let selected = this._g.cy.$(":selected").not("." + CLUSTER_CLASS);
    this.selectedClasses = "";
    this.selectedItemProperties = {};
    let hasNode = selected.filter("node").length > 0;
    if (hasNode && selected.filter("edge").length > 0) {
      return;
    }
    let idMappingForHighlight = {};
    for (let i = 0; i < selected.length; i++) {
      let id = selected[i].id();
      idMappingForHighlight[id] = id;
    }
    this.fillMultiObjectTable(
      selected,
      hasNode,
      idMappingForHighlight,
      isNeed2Filter
    );
  }

  // This function is used to render the properties of the selected object in the object tab
  renderObjectProps(properties: any, classNames: any, selectedCount: number) {
    if (classNames && classNames.length > 0) {
      classNames = classNames.join(" & ");
    }

    // Set the selected classes
    this.selectedClasses = classNames;
    // Reset the selected item properties
    this.selectedItemProperties = {};

    // Prepare the properties to be rendered in the object tab
    // Get ordered keys if only one item is selected
    let properityKeys: string[];
    if (selectedCount === 1) {
      properityKeys =
        this.orderPropertyKeysIf1Selected(classNames) || properityKeys;
    } else {
      properityKeys = Object.keys(properties);
    }

    // Iterate through the properties and prepare the object to be rendered in the object tab
    for (const key of properityKeys) {
      // Replace - and _ with space
      let renderedKey = key.replace(/[_\-]/g, " ");
      let renderedValue = properties[key];

      // If the value is undefined, skip it
      if (renderedValue === undefined) {
        continue;
      }

      renderedValue = this.getMappedProperty(
        this.selectedClasses,
        key,
        renderedValue
      );

      this.selectedItemProperties[`${renderedKey}`] = {
        value: renderedValue,
      };
    }

    // If the object is contained in a path, then process the value further
    if (this.selectedItemProperties["pathNames"]) {
      this.preparePathData();
    }

    // If the object contained in a walk, then process the value further
    if (this.selectedItemProperties["walkSampleIdentifiers"]) {
      this.prepareWalkData();
    }

    // If the object contains overlap, then process the value further
    if (
      this.selectedItemProperties["overlap"] &&
      this.selectedItemProperties["overlap"].value !== "*"
    ) {
      this.selectedItemProperties["overlap"] = {
        value: this.selectedItemProperties["overlap"].value,
        overlapIdentifiers: this.selectedItemProperties["overlap"].value
          .split(/[0-9]+/)
          .slice(1),
        currentIndex: 0,
      };
    }

    // Prepare the combined sequence if an edge is selected
    // Only the edges have associated sourceOrientation
    if (this.selectedItemProperties["sourceOrientation"]) {
      this.prepareCombinedSequenceData();
    }
  }

  // This function is used to prepare the walk data for the selected object in the object tab
  private prepareWalkData() {
    // Create the walkChecked array to keep track of the selected walks
    // Initialize the walkChecked array with false values for each walk
    this.selectedItemProperties["walkChecked"] = [];
    for (
      let i = 0;
      i < this.selectedItemProperties["walkSampleIdentifiers"].length;
      i++
    ) {
      this.selectedItemProperties["walkChecked"].push(false);
    }

    // Extract the walk segment names from the walkSampleIdentifiers
    this.selectedItemProperties["walkHaplotypeIndexes"] = [];
    this.selectedItemProperties["walkSequenceIdentifiers"] = [];
    this.selectedItemProperties["walkSequenceStarts"] = [];
    this.selectedItemProperties["walkSequenceEnds"] = [];
    this.selectedItemProperties["walks"] = [];

    // Iterate through the walk sample identifiers and extract the walk segment names
    this.selectedItemProperties["walkSampleIdentifiers"].value.forEach(
      (walkSampleIdentifier: string) => {
        // Find the walk node in the graph based on the walk sample identifier
        let walk = this._g.cy.nodes(
          `[sampleIdentifier = "${walkSampleIdentifier}"]`
        );

        // If the node is not found, then push undefined values to the walkSegmentNames
        if (walk.empty()) {
          this.selectedItemProperties["walkHaplotypeIndexes"].push(undefined);
          this.selectedItemProperties["walkSequenceIdentifiers"].push(
            undefined
          );
          this.selectedItemProperties["walkSequenceStarts"].push(undefined);
          this.selectedItemProperties["walkSequenceEnds"].push(undefined);
          this.selectedItemProperties["walks"].push(undefined);
          return;
        }

        // If the walk node is found, then extract the walk segment names
        this.selectedItemProperties["walkHaplotypeIndexes"].push(
          walk.data("haplotypeIndex")
        );
        this.selectedItemProperties["walkSequenceIdentifiers"].push(
          walk.data("sequenceIdentifier")
        );
        this.selectedItemProperties["walkSequenceStarts"].push(
          walk.data("sequenceStart")
        );
        this.selectedItemProperties["walkSequenceEnds"].push(
          walk.data("sequenceEnd")
        );
        this.selectedItemProperties["walks"].push(walk.data("walk"));
      }
    );
  }

  // This function is used to prepare the path data for the selected object in the object tab
  private preparePathData() {
    // Create the pathChecked array to keep track of the selected paths
    // Initialize the pathChecked array with false values for each path
    this.selectedItemProperties["pathChecked"] = [];
    for (let i = 0; i < this.selectedItemProperties["pathNames"].length; i++) {
      this.selectedItemProperties["pathChecked"].push(false);
    }

    // Extract the path segment names and path overlaps from the pathNames
    this.selectedItemProperties["pathSegmentNames"] = [];
    this.selectedItemProperties["pathOverlaps"] = [];

    // Iterate through the path names and extract the path segment names and path overlaps
    this.selectedItemProperties["pathNames"].value.forEach(
      (pathName: string) => {
        // Find the path node in the graph based on the path name
        let path = this._g.cy.nodes(`[pathName = "${pathName}"]`);

        // If the node is not found, then push undefined values to the pathSegmentNames and pathOverlaps
        if (path.empty()) {
          this.selectedItemProperties["pathSegmentNames"].push(undefined);
          this.selectedItemProperties["pathOverlaps"].push(undefined);
          return;
        }

        // If the path node is found, then extract the path segment names and path overlaps
        this.selectedItemProperties["pathSegmentNames"].push(
          path.data("segmentNames")
        );
        this.selectedItemProperties["pathOverlaps"].push(path.data("overlaps"));
      }
    );
  }

  // This function is used to prepare the combined sequence data for the selected edge in the object tab
  private prepareCombinedSequenceData() {
    this._g.cy.edges(":selected").forEach((element: any) => {
      // First, prepare the combined sequence
      let combinedSequence =
        this._sequenceDataService.prepareCombinedSequence(element);

      // Every edge type has sequence length attribute, so add it to the selected item properties
      this.selectedItemProperties["sequenceLength"] = {
        value: combinedSequence.sequenceLength,
      };

      // Prepare combined sequence for containment edge type
      // Containment edge type has pos attribute
      if (element.data("pos")) {
        this.selectedItemProperties["leftOfTheContainedSequence"] = {
          value: combinedSequence.firstSequence,
        };
        this.selectedItemProperties["containedSequence"] = {
          value: combinedSequence.secondSequence,
        };
        this.selectedItemProperties["rightOfTheContainedSequence"] = {
          value: combinedSequence.thirdSequence,
        };
      }

      // Prepare combined sequence for jump edge type
      // Jump edge type has distance attribute
      else if (element.data("distance")) {
        this.selectedItemProperties["sourceSequence"] = {
          value: combinedSequence.firstSequence,
        };
        this.selectedItemProperties["targetSequence"] = {
          value: combinedSequence.thirdSequence,
        };
      }

      // Prepare combined sequence for link edge type
      // Link edge type has overlap attribute
      else {
        this.selectedItemProperties["sourceSequenceWithoutOverlap"] = {
          value: combinedSequence.firstSequence,
        };
        this.selectedItemProperties["overlapSequence"] = {
          value: combinedSequence.secondSequence,
        };
        this.selectedItemProperties["targetSequenceWithoutOverlap"] = {
          value: combinedSequence.thirdSequence,
        };
        this.selectedItemProperties["overlap"]["overlapNumerics"] =
          combinedSequence.overlapNumerics;
      }
    });
  }

  prepareCIGARForIndex(index: number): string {
    if (
      this.selectedItemProperties.overlap.currentIndex >=
      this.selectedItemProperties.overlapSequence.value.length
    ) {
      this.selectedItemProperties.overlap.currentIndex = 0;
    }
    let s = this.selectedItemProperties.overlapSequence.value.substring(
      this.selectedItemProperties.overlap.currentIndex,
      this.selectedItemProperties.overlap.currentIndex +
        Number(this.selectedItemProperties.overlap.overlapNumerics[index])
    );
    this.selectedItemProperties.overlap.currentIndex += Number(
      this.selectedItemProperties.overlap.overlapNumerics[index]
    );
    return s;
  }

  getPathsSelected() {
    let segmentNames = [];
    this.selectedItemProperties["pathChecked"].forEach(
      (isChecked: boolean, i: number) => {
        if (isChecked) {
          this.selectedItemProperties.pathSegmentNames[i]
            .split(/[;,]/)
            .forEach((segmentName: string) => {
              segmentNames.push(
                segmentName.substring(0, segmentName.length - 1)
              );
            });
        }
      }
    );
    if (segmentNames.length === 0) {
      return;
    }
    this._dbService.getConsecutiveNodes(
      segmentNames,
      "segmentName",
      "SEGMENT",
      (x) => {
        this._cyService.loadElementsFromDatabase(x, true);
      }
    );
  }

  getWalksSelected() {
    let segmentNames = [];
    this.selectedItemProperties["walkChecked"].forEach(
      (isChecked: boolean, i: number) => {
        if (isChecked) {
          this.selectedItemProperties.walks[i]
            .substring(1)
            .split(/[<>]/)
            .forEach((segmentName: string) => {
              segmentNames.push(segmentName);
            });
        }
      }
    );
    if (segmentNames.length === 0) {
      return;
    }
    this._dbService.getConsecutiveNodes(
      segmentNames,
      "segmentName",
      "SEGMENT",
      (x) => {
        this._cyService.loadElementsFromDatabase(x, true);
      }
    );
  }

  // This function is used to get the path from the database, if the path data is not already loaded
  getPathFromDatabase(pathName: string) {
    // Path is loaded through the pathName using getConsecutiveNodes function
    this._dbService.getConsecutiveNodes([pathName], "pathName", "PATH", (x) => {
      // Load the path fetched from the database
      this._cyService.loadElementsFromDatabase(x, true);
      // Refresh the object tab
      this.showObjectProperties();
    });
  }

  // This function is used to get the walk from the database, if the walk data is not already loaded
  getWalkFromDatabase(walkSampleIdentifier: string) {
    // Walk is loaded through the walkSampleIdentifier using getConsecutiveNodes function
    this._dbService.getConsecutiveNodes(
      [walkSampleIdentifier],
      "sampleIdentifier",
      "WALK",
      (x) => {
        // Load the walk fetched from the database
        this._cyService.loadElementsFromDatabase(x, true);
        // Refresh the object tab
        this.showObjectProperties();
      }
    );
  }

  setOtherPathsFalse(index: number): void {
    for (let i = 0; i < this.selectedItemProperties.pathChecked.length; i++) {
      if (i !== index) {
        this.selectedItemProperties.pathChecked[i] = false;
      }
    }
  }

  setOtherWalksFalse(index: number): void {
    for (let i = 0; i < this.selectedItemProperties.walkChecked.length; i++) {
      if (i !== index) {
        this.selectedItemProperties.walkChecked[i] = false;
      }
    }
  }

  pathWalkNameTransform(name: string): string {
    return this._cyService.pathWalkNameTransform(name);
  }

  // get common key-value pairs for non-nested properties
  getCommonObjectProperties(elementList: any[]) {
    let superObject = {};
    let superClassNames = {};
    let commonProperties = {};
    let commonClassNames = [];
    let firstElement = null;

    // Assume element is instance of Cytoscape.js element
    elementList.forEach((element: any) => {
      const e = element.json();
      let data: any, classes: string, classArray: string[];
      [data, classes, classArray] = [e.data, e.classes, e.classes.split(" ")];

      // construct superClassNames
      for (let i = 0; i < classArray.length; i++) {
        const c = classArray[i];
        if (superClassNames[c]) {
          superClassNames[c] += 1;
        } else {
          superClassNames[c] = 1;
        }
      }

      if (firstElement === null) {
        if (!firstElement) {
          firstElement = {};
        }

        for (let key in data) {
          if (data.hasOwnProperty(key)) {
            firstElement[key] = data[key];
          }
        }
      }

      if (elementList.length === 1) {
        commonClassNames = classArray;
        return;
      }

      // count common key-value pairs
      this.countKeyValuePairs(data, superObject);
    });

    if (elementList.length === 1) {
      return [firstElement, commonClassNames];
    }

    const elementCount = elementList.length;

    // get common key-value pairs
    for (const [k, v] of Object.entries(superObject)) {
      for (const [, v2] of Object.entries(v)) {
        if (v2 === elementCount) {
          commonProperties[k] = firstElement[k];
        }
      }
    }

    // get common class names
    for (const [k, v] of Object.entries(superClassNames)) {
      if (v === elementCount) {
        commonClassNames.push(k);
      }
    }

    return [commonProperties, commonClassNames];
  }

  // This function is used to highlight the path or walk when hovered over the path name
  hightlightHoveredPath(pathName: string) {
    this.highlightedPathWalk = pathName; // Set the highlighted path name

    // Highlight the elements contained in the path
    this._g.cy.elements().forEach((element: any) => {
      if (element.data("pathNames")) {
        element.data("pathNames").forEach((pathValue: any) => {
          if (pathValue.includes(pathName)) {
            this._g.highlightElements(element);
          }
        });
      }
    });
  }

  // This function is used to remove the highlight when the mouse is not hovered over the walk sample identier
  hightlightHoveredWalk(walkName: string) {
    this.highlightedPathWalk = walkName; // Set the highlighted walk sample identifier

    // Highlight the elements contained in the walk
    this._g.cy.elements().forEach((element: any) => {
      if (element.data("walkSampleIdentifiers")) {
        element.data("walkSampleIdentifiers").forEach((walkValue: any) => {
          if (walkValue.includes(walkName)) {
            this._g.highlightElements(element);
          }
        });
      }
    });
  }

  removeHighlightHoveredPathWalk() {
    this.highlightedPathWalk = "";
    this._g.removeHighlights();
  }

  countKeyValuePairs(data: any, superObject: any) {
    for (const [k, v] of Object.entries(data)) {
      const valueProperty = v + "";
      if (superObject[k]) {
        if (superObject[k][valueProperty]) {
          superObject[k][valueProperty] += 1;
        } else {
          superObject[k][valueProperty] = 1;
        }
      } else {
        const o2 = {};
        o2[valueProperty] = 1;
        superObject[k] = o2;
      }
    }
  }

  orderPropertyKeysIf1Selected(classNames: any) {
    const properties = this._g.dataModel.getValue();
    const nodeProps = properties.nodes[classNames];
    const edgeProps = properties.edges[classNames];
    if (nodeProps) {
      return Object.keys(nodeProps);
    } else if (edgeProps) {
      return Object.keys(edgeProps);
    }
    return null;
  }

  getMappedProperty(
    className: string,
    propertyName: string,
    propertyValue: string
  ): string {
    const enumMap = this._g.getEnumMapping();
    let classes = Object.keys(enumMap);
    let c = classes.find((x) => x == className);
    if (!c) {
      return propertyValue;
    }

    const mapping = enumMap[c][propertyName];
    if (!mapping) {
      return propertyValue;
    }
    const value = enumMap[c][propertyName][propertyValue];
    if (value != null || value != undefined) {
      return value;
    }
    return propertyValue;
  }

  showStats() {
    let stat = {};
    let classSet = new Set<string>();
    let elements = this._g.cy.$();
    for (let i = 0; i < elements.length; i++) {
      let current = elements[i];
      let c = current.classes();
      let pass = false;
      TYPES_NOT_TO_SHOW.forEach((type) => {
        if (c.includes(type)) {
          pass = true;
        }
      });
      if (pass) {
        continue;
      }
      let isSelected = current.selected();
      let isVisible = current.visible();
      for (let j = 0; j < c.length; j++) {
        if (
          !this.nodeClasses.has(c[j]) &&
          !this.edgeClasses.has(c[j]) &&
          c[j] != COLLAPSED_EDGE_CLASS
        ) {
          continue;
        }
        classSet.add(c[j]);
        let TYPE_CLASS = current.isNode() ? this.NODE_TYPE : this.EDGE_TYPE;
        this.increaseCountInObject(stat, TYPE_CLASS, "total");
        this.increaseCountInObject(stat, c[j], "total");

        if (isSelected) {
          this.increaseCountInObject(stat, c[j], "selected");
          this.increaseCountInObject(stat, TYPE_CLASS, "selected");
        }
        if (!isVisible) {
          this.increaseCountInObject(stat, c[j], "hidden");
          this.increaseCountInObject(stat, TYPE_CLASS, "hidden");
        }
      }
    }
    classSet.add(this.NODE_TYPE);
    classSet.add(this.EDGE_TYPE);
    this.setStatStrFromObject(stat, classSet);
    this.isShowStatsTable = elements.length > 0;
  }

  private setStatStrFromObject(stat: any, classSet: Set<string>) {
    this.tableInput.results = [];
    this.tableInput.classNames = [];
    for (let c of classSet) {
      if (stat[c] === undefined) {
        continue;
      }
      let cySelector = "." + c;
      // first element must be ID, ID is irrelevant here
      let row: TableData[] = [{ value: cySelector }];
      if (c == this.NODE_TYPE) {
        row[0].value = "node";
        row.push({ value: "Node" });
      } else if (c == this.EDGE_TYPE) {
        row[0].value = "edge";
        row.push({ value: "Edge" });
      } else if (c == COLLAPSED_EDGE_CLASS) {
        row[0].value = "." + COLLAPSED_EDGE_CLASS;
        row.push({ value: "Meta edge" });
      } else {
        row.push({ value: c });
      }
      row.push({ value: stat[c].total });

      if (stat[c]["selected"]) {
        row.push({ value: stat[c]["selected"] });
      } else {
        row.push({ value: 0 });
      }
      if (stat[c]["hidden"]) {
        row.push({ value: stat[c]["hidden"] });
      } else {
        row.push({ value: 0 });
      }
      this.tableInput.results.push(row);
      this.tableInput.classNames.push(row[1].value);
    }
    this.tableInput.pageSize = this._g.userPreferences.dataPageSize.getValue();

    // let tableView ngOnInit finish
    setTimeout(() => this.tableFilled.next(true), 100);
  }

  private increaseCountInObject(object: any, p1: string, p2: string) {
    if (object[p1]) {
      if (object[p1][p2] === undefined) {
        object[p1][p2] = 1;
      } else {
        object[p1][p2] += 1;
      }
    } else {
      object[p1] = {};
      object[p1][p2] = 1;
    }
  }

  filterTable(filter: TableFiltering) {
    this.showStats();
    filterTableDatas(
      filter,
      this.tableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
    setTimeout(() => this.tableFilled.next(true), 100);
  }

  filterMultipleObjectTable(filter: TableFiltering) {
    if (
      this._g.cy.edges(":selected").filter("." + COLLAPSED_EDGE_CLASS).length >
      0
    ) {
      this.showCompoundEdgeProperties(false);
    } else {
      this.showMultipleObjectTable(false);
    }
    filterTableDatas(
      filter,
      this.multipleObjectTableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
    setTimeout(() => {
      this.multiObjectTableFilled.next(true);
    }, 100);
  }
}
