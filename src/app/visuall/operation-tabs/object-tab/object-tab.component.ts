import { Component, OnDestroy, OnInit } from "@angular/core";
import { GlobalVariableService } from "../../global-variable.service";
import {
  getPropNamesFromObj,
  findTypeOfAttribute,
  debounce,
  COLLAPSED_EDGE_CLASS,
  OBJ_INFO_UPDATE_DELAY,
  CLUSTER_CLASS,
  extend,
  TYPES_NOT_TO_SHOW,
} from "../../constants";
import { DbAdapterService } from "../../db-service/db-adapter.service";
import {
  TableViewInput,
  TableData,
  TableDataType,
  TableFiltering,
  property2TableData,
  filterTableDatas,
} from "../../../shared/table-view/table-view-types";
import { Subject, Subscription } from "rxjs";
import { CytoscapeService } from "../../cytoscape.service";
import { CustomizationModule } from "../../../custom/customization.module";

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
  customSubTabs: { component: any; text: string }[] =
    CustomizationModule.objSubTabs;

  tableInput: TableViewInput = {
    columns: ["Type", "Count", "Selected", "Hidden"],
    isHide0: true,
    results: [],
    resultCnt: 0,
    currPage: 1,
    pageSize: 20,
    tableTitle: "Statistics",
    isShowExportAsCSV: true,
    isLoadGraph: true,
    columnLimit: 5,
    isMergeGraph: false,
    isNodeData: false,
    isUseCySelector4Highlight: true,
    isHideLoadGraph: true,
  };

  multiObjTableInp: TableViewInput = {
    columns: ["Type"],
    isHide0: true,
    results: [],
    resultCnt: 0,
    currPage: 1,
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
  };

  private NODE_TYPE = "_NODE_";
  private EDGE_TYPE = "_EDGE_";
  shownElemsSubs: Subscription;
  appDescSubs: Subscription;
  dataModelSubs: Subscription;

  constructor(
    private _g: GlobalVariableService,
    private _dbService: DbAdapterService,
    private _cyService: CytoscapeService
  ) {
    this.selectedItemProps = {};
  }

  ngOnInit() {
    this.appDescSubs = this._g.appDescription.subscribe((x) => {
      if (x === null) {
        return;
      }
      this.dataModelSubs = this._g.dataModel.subscribe((x2) => {
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

        this.shownElemsSubs = this._g.shownElemsChanged.subscribe(() => {
          this.showStats();
        });
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
    if (this.appDescSubs) {
      this.appDescSubs.unsubscribe();
    }
    if (this.dataModelSubs) {
      this.dataModelSubs.unsubscribe();
    }
    if (this.shownElemsSubs) {
      this.shownElemsSubs.unsubscribe();
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
    let definedProperties = getPropNamesFromObj(
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
    elems,
    isNode: boolean,
    idMappingForHighlight: any,
    isNeed2Filter: boolean
  ) {
    this.multiObjTableInp.isNodeData = isNode;
    let elemTypesArr = elems.map((x) => x.classes()[0]);
    let elemTypes = {};
    for (let i = 0; i < elemTypesArr.length; i++) {
      elemTypes[elemTypesArr[i]] = true;
    }
    const properties = this._g.dataModel.getValue();
    let definedProperties = {};
    for (let edgeType in elemTypes) {
      if (isNode) {
        for (let j in properties.nodes[edgeType]) {
          definedProperties[j] = true;
        }
      } else {
        for (let j in properties.edges[edgeType]) {
          definedProperties[j] = true;
        }
      }
    }
    this.multiObjTableInp.columns = ["Type"].concat(
      Object.keys(definedProperties)
    );
    this.multiObjTableInp.results = [];
    this.multiObjTableInp.classNames = [];
    let elemTypeCnt = {};
    const enumMapping = this._g.getEnumMapping();
    for (let i = 0; i < elems.length; i++) {
      let className = elems[i].classes()[0];
      if (elemTypeCnt[className]) {
        elemTypeCnt[className] += 1;
      } else {
        elemTypeCnt[className] = 1;
      }
      let row: TableData[] = [
        {
          type: TableDataType.string,
          val: "#" + idMappingForHighlight[elems[i].id()],
        },
        { type: TableDataType.string, val: className },
      ];
      for (let j in definedProperties) {
        row.push(
          property2TableData(
            properties,
            enumMapping,
            j,
            elems[i].data(j) ?? "",
            className,
            !isNode
          )
        );
      }
      this.multiObjTableInp.results.push(row);
      this.multiObjTableInp.classNames.push(className);
    }
    for (let k in elemTypeCnt) {
      this.selectedClasses += k + "(" + elemTypeCnt[k] + ") ";
    }
    this.multiObjTableInp.pageSize = this._g.userPrefs.dataPageSize.getValue();
    this.multiObjTableInp.currPage = 1;
    this.multiObjTableInp.resultCnt = this.multiObjTableInp.results.length;
    // if too many edges need to be shown, we should make pagination
    if (isNeed2Filter) {
      this.clearMultiObjTableFilter.next(true);
      filterTableDatas(
        { orderBy: "", orderDirection: "", txt: "" },
        this.multiObjTableInp,
        this._g.userPrefs.isIgnoreCaseInText.getValue()
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

  renderObjectProps(props, classNames, selectedCount) {
    if (classNames && classNames.length > 0) {
      classNames = classNames.join(" & ");
    }

    this.selectedClasses = classNames;
    this.selectedItemProps = {};

    let propKeys = Object.keys(props);
    // get ordered keys if only one item is selected
    if (selectedCount === 1) {
      propKeys = this.orderPropertyKeysIf1Selected(classNames) || propKeys;
    }
    const properties = this._g.dataModel.getValue();
    for (const key of propKeys) {
      // Replace - and _ with space
      let renderedKey = key.replace(/[_\-]/g, " ");
      let renderedValue = props[key];

      const attributeType = findTypeOfAttribute(
        key,
        properties.nodes,
        properties.edges
      );
      if (attributeType === "datetime") {
        if (typeof renderedValue !== "undefined") {
          renderedValue = new Date(renderedValue).toLocaleString();
        } else {
          renderedValue = "";
        }
      }
      if (renderedValue !== undefined) {
        renderedValue = this.getMappedProperty(
          this.selectedClasses,
          key,
          renderedValue
        );

        if (renderedKey === "pathNames") {
          this.selectedItemProps[`${renderedKey}`] = {
            val: renderedValue,
          };
          this.selectedItemProps["pathChecked"] = [];

          for (let i = 0; i < renderedValue.length; i++) {
            this.selectedItemProps["pathChecked"].push(false);
          }

          this.selectedItemProps["pathSegmentNames"] = [];
          this.selectedItemProps["pathOverlaps"] = [];

          renderedValue.forEach((pathName) => {
            this._g.cy.nodes().forEach((element) => {
              if (element.hasClass("PATHS")) {
                let counter = 0;
                element.data(`p${pathName}`).forEach((pathVal) => {
                  if (counter === 0) {
                    this.selectedItemProps["pathSegmentNames"].push(pathVal);
                  } else {
                    this.selectedItemProps["pathOverlaps"].push(pathVal);
                  }
                  counter++;
                });
              }
            });
          });
        } else if (renderedKey === "walkSampleIds") {
          this.selectedItemProps[`${renderedKey}`] = {
            val: renderedValue,
          };
          this.selectedItemProps[`walkChecked`] = [];

          for (let i = 0; i < renderedValue.length; i++) {
            this.selectedItemProps[`walkChecked`].push(false);
          }

          this.selectedItemProps["walkHapIndexes"] = [];
          this.selectedItemProps["walkSeqIds"] = [];
          this.selectedItemProps["walkSeqStarts"] = [];
          this.selectedItemProps["walkSeqEnds"] = [];
          this.selectedItemProps["walks"] = [];

          renderedValue.forEach((walkName) => {
            this._g.cy.nodes().forEach((element) => {
              if (element.hasClass("WALKS")) {
                let counter = 0;
                element.data(`w${walkName}`).forEach((walkVal) => {
                  if (counter === 0) {
                    this.selectedItemProps["walkHapIndexes"].push(walkVal);
                  } else if (counter === 1) {
                    this.selectedItemProps["walkSeqIds"].push(walkVal);
                  } else if (counter === 2) {
                    this.selectedItemProps["walkSeqStarts"].push(walkVal);
                  } else if (counter === 3) {
                    this.selectedItemProps["walkSeqEnds"].push(walkVal);
                  } else {
                    this.selectedItemProps["walks"].push(walkVal);
                  }
                  counter++;
                });
              }
            });
          });
        } else if (renderedKey === "overlap") {
          this.selectedItemProps[`${renderedKey}`] = {
            val: renderedValue,
            overlapIdentifiers: renderedValue.split(/[0-9]+/).slice(1),
            currentIndex: 0,
          };
        } else {
          this.selectedItemProps[`${renderedKey}`] = {
            val: renderedValue,
          };
        }
      }
    }

    if (this.selectedItemProps["sourceOrientation"]) {
      // for combined sequence
      this._g.cy.edges(":selected").forEach((element) => {
        let combinedSequence = this._cyService.prepareCombinedSequence(element);

        if (element.data("pos")) {
          this.selectedItemProps["leftOfTheContainedSequence"] = {
            val: combinedSequence.firstSequence,
          };
          this.selectedItemProps["containedSequence"] = {
            val: combinedSequence.secondSequence,
          };
          this.selectedItemProps["rightOfTheContainedSequence"] = {
            val: combinedSequence.thirdSequence,
          };
        } else if (element.data("distance")) {
          this.selectedItemProps["sourceSequence"] = {
            val: combinedSequence.firstSequence,
          };
          this.selectedItemProps["targetSequence"] = {
            val: combinedSequence.thirdSequence,
          };
        } else {
          this.selectedItemProps["sourceSequenceWithoutOverlap"] = {
            val: combinedSequence.firstSequence,
          };
          this.selectedItemProps["overlapSequence"] = {
            val: combinedSequence.secondSequence,
          };
          this.selectedItemProps["targetSequenceWithoutOverlap"] = {
            val: combinedSequence.thirdSequence,
          };
          this.selectedItemProps["overlap"]["overlapNumerics"] = combinedSequence.overlapNumerics;
        }

        this.selectedItemProps["sequenceLength"] = {
          val: combinedSequence.sequenceLength,
        };
      });
    }
  }

  prepareCIGARForIndex(index: number): string {
    if (
      this.selectedItemProps.overlap.currentIndex >=
      this.selectedItemProps.overlapSequence.val.length
    ) {
      this.selectedItemProps.overlap.currentIndex = 0;
    }
    let s = this.selectedItemProps.overlapSequence.val.substring(
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
    this.selectedItemProps["pathChecked"].forEach((isChecked, i) => {
      if (isChecked) {
        this.selectedItemProps.pathSegmentNames[i]
          .split(/[;,]/)
          .forEach((segmentName) => {
            segmentNames.push(segmentName.substring(0, segmentName.length - 1));
          });
      }
    });
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
    this.selectedItemProps["walkChecked"].forEach((isChecked, i) => {
      if (isChecked) {
        this.selectedItemProps.walks[i]
          .substring(1)
          .split(/[<>]/)
          .forEach((segmentName) => {
            segmentNames.push(segmentName);
          });
      }
    });
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

  // get common key-value pairs for non-nested properties
  getCommonObjectProps(eleList) {
    let superObj = {};
    let superClassNames = {};
    let commonProps = {};
    let commonClassNames = [];
    let firstElem = null;

    // Assume ele is instance of Cytoscape.js element
    eleList.forEach((ele) => {
      const e = ele.json();
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

      if (firstElem === null) {
        firstElem = extend(firstElem, data);
      }

      if (eleList.length === 1) {
        commonClassNames = classArray;
        return;
      }

      // count common key-value pairs
      this.countKeyValuePairs(data, superObj);
    });

    if (eleList.length === 1) {
      return [firstElem, commonClassNames];
    }

    const eleCount = eleList.length;

    // get common key-value pairs
    for (const [k, v] of Object.entries(superObj)) {
      for (const [, v2] of Object.entries(v)) {
        if (v2 === eleCount) {
          commonProps[k] = firstElem[k];
        }
      }
    }

    // get common class names
    for (const [k, v] of Object.entries(superClassNames)) {
      if (v === eleCount) {
        commonClassNames.push(k);
      }
    }

    return [commonProps, commonClassNames];
  }

  hightlightHoveredPath(pathName: string) {
    this.highlightedPathWalk = pathName;
    this._g.cy.elements().forEach((element) => {
      if (element.data("pathNames")) {
        element.data("pathNames").forEach((pathVal) => {
          if (pathVal.includes(pathName)) {
            this._g.highlightElements(element);
          }
        });
      }
    });
  }

  hightlightHoveredWalk(walkName: string) {
    this.highlightedPathWalk = walkName;
    this._g.cy.elements().forEach((element) => {
      if (element.data("walkSampleIds")) {
        element.data("walkSampleIds").forEach((walkVal) => {
          if (walkVal.includes(walkName)) {
            this._g.highlightElements(element);
          }
        });
      }
    });
  }

  removeHighlightHoveredPathWalk() {
    this.highlightedPathWalk = "";
    this._g.viewUtils.removeHighlights();
  }

  countKeyValuePairs(data, superObj) {
    for (const [k, v] of Object.entries(data)) {
      const valueProperty = v + "";
      if (superObj[k]) {
        if (superObj[k][valueProperty]) {
          superObj[k][valueProperty] += 1;
        } else {
          superObj[k][valueProperty] = 1;
        }
      } else {
        const o2 = {};
        o2[valueProperty] = 1;
        superObj[k] = o2;
      }
    }
  }

  orderPropertyKeysIf1Selected(classNames) {
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
    const val = enumMap[c][propertyName][propertyValue];
    if (val != null || val != undefined) {
      return val;
    }
    return propertyValue;
  }

  showStats() {
    let stat = {};
    let classSet = new Set<string>();
    let elems = this._g.cy.$();
    for (let i = 0; i < elems.length; i++) {
      let curr = elems[i];
      let c = curr.classes();
      let pass = false;
      TYPES_NOT_TO_SHOW.forEach((type) => {
        if (c.includes(type)) {
          pass = true;
        }
      });
      if (pass) {
        continue;
      }
      let isSelected = curr.selected();
      let isVisible = curr.visible();
      for (let j = 0; j < c.length; j++) {
        if (
          !this.nodeClasses.has(c[j]) &&
          !this.edgeClasses.has(c[j]) &&
          c[j] != COLLAPSED_EDGE_CLASS
        ) {
          continue;
        }
        classSet.add(c[j]);
        let TYPE_CLASS = curr.isNode() ? this.NODE_TYPE : this.EDGE_TYPE;
        this.increaseCountInObj(stat, TYPE_CLASS, "total");
        this.increaseCountInObj(stat, c[j], "total");

        if (isSelected) {
          this.increaseCountInObj(stat, c[j], "selected");
          this.increaseCountInObj(stat, TYPE_CLASS, "selected");
        }
        if (!isVisible) {
          this.increaseCountInObj(stat, c[j], "hidden");
          this.increaseCountInObj(stat, TYPE_CLASS, "hidden");
        }
      }
    }
    classSet.add(this.NODE_TYPE);
    classSet.add(this.EDGE_TYPE);
    this.setStatStrFromObj(stat, classSet);
    this.isShowStatsTable = elems.length > 0;
  }

  private setStatStrFromObj(stat, classSet: Set<string>) {
    this.tableInput.results = [];
    this.tableInput.classNames = [];
    for (let c of classSet) {
      if (stat[c] === undefined) {
        continue;
      }
      let cySelector = "." + c;
      // first element must be ID, ID is irrelevant here
      let row: TableData[] = [{ val: cySelector, type: TableDataType.string }];
      if (c == this.NODE_TYPE) {
        row[0].val = "node";
        row.push({ val: "Node", type: TableDataType.string });
      } else if (c == this.EDGE_TYPE) {
        row[0].val = "edge";
        row.push({ val: "Edge", type: TableDataType.string });
      } else if (c == COLLAPSED_EDGE_CLASS) {
        row[0].val = "." + COLLAPSED_EDGE_CLASS;
        row.push({ val: "Meta edge", type: TableDataType.string });
      } else {
        row.push({ val: c, type: TableDataType.string });
      }
      row.push({ val: stat[c].total, type: TableDataType.number });

      if (stat[c]["selected"]) {
        row.push({ val: stat[c]["selected"], type: TableDataType.number });
      } else {
        row.push({ val: 0, type: TableDataType.number });
      }
      if (stat[c]["hidden"]) {
        row.push({ val: stat[c]["hidden"], type: TableDataType.number });
      } else {
        row.push({ val: 0, type: TableDataType.number });
      }
      this.tableInput.results.push(row);
      this.tableInput.classNames.push(row[1].val);
    }
    this.tableInput.pageSize = this._g.userPrefs.dataPageSize.getValue();

    // let tableView ngOnInit finish
    setTimeout(() => this.tableFilled.next(true), 100);
  }

  private increaseCountInObj(obj, p1: string, p2: string) {
    if (obj[p1]) {
      if (obj[p1][p2] === undefined) {
        obj[p1][p2] = 1;
      } else {
        obj[p1][p2] += 1;
      }
    } else {
      obj[p1] = {};
      obj[p1][p2] = 1;
    }
  }

  filterTable(filter: TableFiltering) {
    this.showStats();
    filterTableDatas(
      filter,
      this.tableInput,
      this._g.userPrefs.isIgnoreCaseInText.getValue()
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
      this._g.userPrefs.isIgnoreCaseInText.getValue()
    );
    setTimeout(() => this.multiObjTableFilled.next(true), 100);
  }
}
