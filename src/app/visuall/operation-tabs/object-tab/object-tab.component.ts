import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subject, Subscription } from "rxjs";
import {
  TableData,
  TableDataType,
  TableFiltering,
  TableViewInput,
  filterTableDatas,
  property2TableData,
} from "../../../shared/table-view/table-view-types";
import {
  CLUSTER_CLASS,
  COLLAPSED_EDGE_CLASS,
  OBJ_INFO_UPDATE_DELAY,
  TYPES_NOT_TO_SHOW,
  debounce,
  extend,
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
  selectedItemProps: any;
  tableFilled = new Subject<boolean>();
  multiObjTableFilled = new Subject<boolean>();
  clearMultiObjTableFilter = new Subject<boolean>();
  isShowStatsTable: boolean = false;
  isShowObjTable: boolean = false;
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

  multiObjTableInp: TableViewInput = {
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
    this.selectedItemProps = {};
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
        this.showObjectProps();
        this.showStats();
        this._cyService.showObjPropsFn = debounce(
          this.showObjectProps,
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

  showObjectProps() {
    let selected = this._g.cy.$(":selected");
    this.isShowObjTable = false;
    if (selected.filter("." + COLLAPSED_EDGE_CLASS).length > 0) {
      this.isShowObjTable = true;
      this.showCompoundEdgeProps(true);
      return;
    }
    if (
      selected.length > 1 &&
      (selected.length == selected.filter("node").length ||
        selected.length == selected.filter("edge").length)
    ) {
      this.isShowObjTable = true;
      this.showMultiObjTable(true);
      return;
    }
    const selectedNonMeta = selected.not("." + COLLAPSED_EDGE_CLASS);
    let props: { [x: string]: any }, classNames: any[];
    [props, classNames] = this.getCommonObjectProps(selectedNonMeta);
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

  showCompoundEdgeProps(isNeed2Filter: boolean) {
    const compoundEdges = this._g.cy
      .edges(":selected")
      .filter("." + COLLAPSED_EDGE_CLASS);
    const selectedNodeCnt = this._g.cy.nodes(":selected").length;
    this.selectedClasses = "";
    this.selectedItemProps = {};
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
    this.fillMultiObjTable(edges, false, idMappingForHighlight, isNeed2Filter);
  }

  private fillMultiObjTable(
    elements: any,
    isNode: boolean,
    idMappingForHighlight: any,
    isNeed2Filter: boolean
  ) {
    this.multiObjTableInp.isNodeData = isNode;
    let elementTypesArr = elements.map((x: any) => x.classes()[0]);
    let elementTypes = {};
    for (let i = 0; i < elementTypesArr.length; i++) {
      elementTypes[elementTypesArr[i]] = true;
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
    this.multiObjTableInp.columns = ["Type"].concat(
      Object.keys(definedProperties)
    );
    this.multiObjTableInp.results = [];
    this.multiObjTableInp.classNames = [];
    let elementTypeCount = {};
    const enumMapping = this._g.getEnumMapping();
    for (let i = 0; i < elements.length; i++) {
      let className = elements[i].classes()[0];
      if (elementTypeCount[className]) {
        elementTypeCount[className] += 1;
      } else {
        elementTypeCount[className] = 1;
      }
      let row: TableData[] = [
        {
          type: TableDataType.string,
          value: "#" + idMappingForHighlight[elements[i].id()],
        },
        { type: TableDataType.string, value: className },
      ];
      for (let j in definedProperties) {
        if (elements[i].data(j)) {
          row.push(
            property2TableData(
              properties,
              enumMapping,
              j,
              elements[i].data(j) ?? "",
              className,
              !isNode
            )
          );
        }
      }
      this.multiObjTableInp.results.push(row);
      this.multiObjTableInp.classNames.push(className);
    }
    for (let k in elementTypeCount) {
      this.selectedClasses += k + "(" + elementTypeCount[k] + ") ";
    }
    this.multiObjTableInp.pageSize =
      this._g.userPreferences.dataPageSize.getValue();
    this.multiObjTableInp.currentPage = 1;
    this.multiObjTableInp.resultCount = this.multiObjTableInp.results.length;
    // if too many edges need to be shown, we should make pagination
    if (isNeed2Filter) {
      this.clearMultiObjTableFilter.next(true);
      filterTableDatas(
        { orderBy: "", orderDirection: "", txt: "" },
        this.multiObjTableInp,
        this._g.userPreferences.isIgnoreCaseInText.getValue()
      );
    }
    setTimeout(() => {
      this.multiObjTableFilled.next(true);
    }, 100);
  }

  showMultiObjTable(isNeed2Filter: boolean) {
    let selected = this._g.cy.$(":selected").not("." + CLUSTER_CLASS);
    this.selectedClasses = "";
    this.selectedItemProps = {};
    let hasNode = selected.filter("node").length > 0;
    if (hasNode && selected.filter("edge").length > 0) {
      return;
    }
    let idMappingForHighlight = {};
    for (let i = 0; i < selected.length; i++) {
      let id = selected[i].id();
      idMappingForHighlight[id] = id;
    }
    this.fillMultiObjTable(
      selected,
      hasNode,
      idMappingForHighlight,
      isNeed2Filter
    );
  }

  renderObjectProps(props: any, classNames: any, selectedCount: number) {
    if (classNames && classNames.length > 0) {
      classNames = classNames.join(" & ");
    }

    this.selectedClasses = classNames;
    this.selectedItemProps = {};
    let propKeys: string[];
    let pathNode = this._g.cy.nodes(".PATH")[0];
    let walkNode = this._g.cy.nodes(".WALK")[0];

    // get ordered keys if only one item is selected
    if (selectedCount === 1) {
      propKeys = this.orderPropertyKeysIf1Selected(classNames) || propKeys;
    } else {
      propKeys = Object.keys(props);
    }

    for (const key of propKeys) {
      // Replace - and _ with space
      let renderedKey = key.replace(/[_\-]/g, " ");
      let renderedValue = props[key];

      if (renderedValue !== undefined) {
        renderedValue = this.getMappedProperty(
          this.selectedClasses,
          key,
          renderedValue
        );

        if (renderedKey === "pathNames") {
          this.selectedItemProps[`${renderedKey}`] = {
            value: renderedValue,
          };
          this.selectedItemProps["pathChecked"] = [];
          this.selectedItemProps["pathSegmentNames"] = [];
          this.selectedItemProps["pathOverlaps"] = [];

          for (let i = 0; i < renderedValue.length; i++) {
            this.selectedItemProps["pathChecked"].push(false);
          }

          renderedValue.forEach((pathName: string) => {
            let counter = 0;
            pathNode.data(`p${pathName}`).forEach((pathValue: string) => {
              if (counter === 0) {
                this.selectedItemProps["pathSegmentNames"].push(pathValue);
              } else {
                this.selectedItemProps["pathOverlaps"].push(pathValue);
              }
              counter++;
            });
          });
        } else if (renderedKey === "walkSampleIdentifiers") {
          this.selectedItemProps[`${renderedKey}`] = {
            value: renderedValue,
          };
          this.selectedItemProps[`walkChecked`] = [];
          this.selectedItemProps["walkHapIndexes"] = [];
          this.selectedItemProps["walkSeqIds"] = [];
          this.selectedItemProps["walkSeqStarts"] = [];
          this.selectedItemProps["walkSeqEnds"] = [];
          this.selectedItemProps["walks"] = [];

          for (let i = 0; i < renderedValue.length; i++) {
            this.selectedItemProps[`walkChecked`].push(false);
          }

          renderedValue.forEach((walkName: string) => {
            let counter = 0;
            walkNode.data(`w${walkName}`).forEach((walkValue: string) => {
              if (counter === 0) {
                this.selectedItemProps["walkHapIndexes"].push(walkValue);
              } else if (counter === 1) {
                this.selectedItemProps["walkSeqIds"].push(walkValue);
              } else if (counter === 2) {
                this.selectedItemProps["walkSeqStarts"].push(walkValue);
              } else if (counter === 3) {
                this.selectedItemProps["walkSeqEnds"].push(walkValue);
              } else {
                this.selectedItemProps["walks"].push(walkValue);
              }
              counter++;
            });
          });
        } else if (renderedKey === "overlap") {
          this.selectedItemProps[`${renderedKey}`] = {
            value: renderedValue,
            overlapIdentifiers: renderedValue.split(/[0-9]+/).slice(1),
            currentIndex: 0,
          };
        } else {
          this.selectedItemProps[`${renderedKey}`] = {
            value: renderedValue,
          };
        }
      }
    }

    // for combined sequence if an edge is selected
    if (this.selectedItemProps["sourceOrientation"]) {
      this._g.cy.edges(":selected").forEach((element: any) => {
        let combinedSequence =
          this._sequenceDataService.prepareCombinedSequence(element);

        if (element.data("pos")) {
          this.selectedItemProps["leftOfTheContainedSequence"] = {
            value: combinedSequence.firstSequence,
          };
          this.selectedItemProps["containedSequence"] = {
            value: combinedSequence.secondSequence,
          };
          this.selectedItemProps["rightOfTheContainedSequence"] = {
            value: combinedSequence.thirdSequence,
          };
        } else if (element.data("distance")) {
          this.selectedItemProps["sourceSequence"] = {
            value: combinedSequence.firstSequence,
          };
          this.selectedItemProps["targetSequence"] = {
            value: combinedSequence.thirdSequence,
          };
        } else {
          this.selectedItemProps["sourceSequenceWithoutOverlap"] = {
            value: combinedSequence.firstSequence,
          };
          this.selectedItemProps["overlapSequence"] = {
            value: combinedSequence.secondSequence,
          };
          this.selectedItemProps["targetSequenceWithoutOverlap"] = {
            value: combinedSequence.thirdSequence,
          };
          this.selectedItemProps["overlap"]["overlapNumerics"] =
            combinedSequence.overlapNumerics;
        }

        this.selectedItemProps["sequenceLength"] = {
          value: combinedSequence.sequenceLength,
        };
      });
    }
  }

  prepareCIGARForIndex(index: number): string {
    if (
      this.selectedItemProps.overlap.currentIndex >=
      this.selectedItemProps.overlapSequence.value.length
    ) {
      this.selectedItemProps.overlap.currentIndex = 0;
    }
    let s = this.selectedItemProps.overlapSequence.value.substring(
      this.selectedItemProps.overlap.currentIndex,
      this.selectedItemProps.overlap.currentIndex +
        Number(this.selectedItemProps.overlap.overlapNumerics[index])
    );
    this.selectedItemProps.overlap.currentIndex += Number(
      this.selectedItemProps.overlap.overlapNumerics[index]
    );
    return s;
  }

  getPathsSelected() {
    let segmentNames = [];
    this.selectedItemProps["pathChecked"].forEach(
      (isChecked: boolean, i: number) => {
        if (isChecked) {
          this.selectedItemProps.pathSegmentNames[i]
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
    this.selectedItemProps["walkChecked"].forEach(
      (isChecked: boolean, i: number) => {
        if (isChecked) {
          this.selectedItemProps.walks[i]
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

  setOtherPathsFalse(index: number): void {
    for (let i = 0; i < this.selectedItemProps.pathChecked.length; i++) {
      if (i !== index) {
        this.selectedItemProps.pathChecked[i] = false;
      }
    }
  }

  setOtherWalksFalse(index: number): void {
    for (let i = 0; i < this.selectedItemProps.walkChecked.length; i++) {
      if (i !== index) {
        this.selectedItemProps.walkChecked[i] = false;
      }
    }
  }

  pathWalkNameTransform(name: string): string {
    return this._cyService.pathWalkNameTransform(name);
  }

  // get common key-value pairs for non-nested properties
  getCommonObjectProps(elementList: any[]) {
    let superObj = {};
    let superClassNames = {};
    let commonProps = {};
    let commonClassNames = [];
    let firstElement = null;

    // Assume element is instance of Cytoscape.js element
    elementList.forEach((element: any) => {
      const e = element.json();
      const data = e.data;
      const classes = e.classes;
      const classArray = classes.split(" ");

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
        firstElement = extend(firstElement, data);
      }

      if (elementList.length === 1) {
        commonClassNames = classArray;
        return;
      }

      // count common key-value pairs
      this.countKeyValuePairs(data, superObj);
    });

    if (elementList.length === 1) {
      return [firstElement, commonClassNames];
    }

    const elementCount = elementList.length;

    // get common key-value pairs
    for (const [k, v] of Object.entries(superObj)) {
      for (const [, v2] of Object.entries(v)) {
        if (v2 === elementCount) {
          commonProps[k] = firstElement[k];
        }
      }
    }

    // get common class names
    for (const [k, v] of Object.entries(superClassNames)) {
      if (v === elementCount) {
        commonClassNames.push(k);
      }
    }

    return [commonProps, commonClassNames];
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
      let row: TableData[] = [
        { value: cySelector, type: TableDataType.string },
      ];
      if (c == this.NODE_TYPE) {
        row[0].value = "node";
        row.push({ value: "Node", type: TableDataType.string });
      } else if (c == this.EDGE_TYPE) {
        row[0].value = "edge";
        row.push({ value: "Edge", type: TableDataType.string });
      } else if (c == COLLAPSED_EDGE_CLASS) {
        row[0].value = "." + COLLAPSED_EDGE_CLASS;
        row.push({ value: "Meta edge", type: TableDataType.string });
      } else {
        row.push({ value: c, type: TableDataType.string });
      }
      row.push({ value: stat[c].total, type: TableDataType.number });

      if (stat[c]["selected"]) {
        row.push({ value: stat[c]["selected"], type: TableDataType.number });
      } else {
        row.push({ value: 0, type: TableDataType.number });
      }
      if (stat[c]["hidden"]) {
        row.push({ value: stat[c]["hidden"], type: TableDataType.number });
      } else {
        row.push({ value: 0, type: TableDataType.number });
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

  filterMultiObjTable(filter: TableFiltering) {
    if (
      this._g.cy.edges(":selected").filter("." + COLLAPSED_EDGE_CLASS).length >
      0
    ) {
      this.showCompoundEdgeProps(false);
    } else {
      this.showMultiObjTable(false);
    }
    filterTableDatas(
      filter,
      this.multiObjTableInp,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
    setTimeout(() => {
      this.multiObjTableFilled.next(true);
    }, 100);
  }
}
