import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Subject, Subscription } from "rxjs";
import {
  TableData,
  TableDataType,
  TableFiltering,
  TableRowMeta,
  TableViewInput,
  property2TableData,
} from "../../../shared/table-view/table-view-types";
import {
  CLUSTER_CLASS,
  COLLAPSED_EDGE_CLASS,
  GENERIC_TYPE,
  TYPES_NOT_TO_SHOW,
} from "../../constants";
import { CytoscapeService } from "../../cytoscape.service";
import {
  DbResponse,
  DbResponseType,
  GraphResponse,
  HistoryMetaData,
} from "../../db-service/data-types";
import { DbAdapterService } from "../../db-service/db-adapter.service";
import { GlobalVariableService } from "../../global-variable.service";
import { MergedElemIndicatorTypes } from "../../user-preference";
import { UserProfileService } from "../../user-profile.service";
import { GroupTabComponent } from "./group-tab/group-tab.component";
import {
  ClassBasedRules,
  ClassOption,
  QueryRule,
  Rule,
  RuleNode,
  RuleSync,
  deepCopyRuleNode,
  getBoolExpressionFromMetric,
} from "./query-types";

@Component({
  selector: "app-map-tab",
  templateUrl: "./map-tab.component.html",
  styleUrls: ["./map-tab.component.css"],
})
export class MapTabComponent implements OnInit, OnDestroy {
  classOptions: ClassOption[];
  selectedClassProps: string[];
  selectedClass: string;
  attributeType: string;
  queryRule: ClassBasedRules;
  currRuleNode: RuleNode;
  editedRuleNode: Subject<RuleNode> = new Subject<RuleNode>();
  isQueryOnDb: boolean;
  currProperties: Subject<RuleSync> = new Subject<RuleSync>();
  editingPropertyRule: Rule;
  tableInput: TableViewInput = {
    columns: [],
    tableTitle: "Query Results",
    results: [],
    resultCnt: 0,
    currPage: 1,
    pageSize: 0,
    isShowExportAsCSV: true,
    isEmphasizeOnHover: true,
    isLoadGraph: false,
    isMergeGraph: true,
    isNodeData: true,
    isReplace_inHeaders: true,
  };
  tableFilled = new Subject<boolean>();
  isClassTypeLocked: boolean;
  private isGroupTabOpen = false;
  @ViewChild(GroupTabComponent, { static: false })
  private groupComponent: GroupTabComponent;
  currRules: QueryRule[] = [];
  isAddingNewRule = false;
  changeBtnTxt = "Update";
  currRuleName = "New rule";
  isShowPropertyRule = true;
  loadFromFileSubs: Subscription;
  dataPageSizeSubs: Subscription;
  appDescSubs: Subscription;
  dataModelSubs: Subscription;
  dbResponse: DbResponse = null;
  clearTableFilter = new Subject<boolean>();

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _dbService: DbAdapterService,
    private _profile: UserProfileService
  ) {
    this.isQueryOnDb = true;
    this.tableInput.isMergeGraph = true;
    this.classOptions = [];
    this.selectedClassProps = [];
    this.loadFromFileSubs = this._profile.onLoadFromFile.subscribe((x) => {
      if (!x) {
        return;
      }
      this.setCurrRulesFromLocalStorage();
    });
  }

  ngOnInit() {
    this.dataPageSizeSubs = this._g.userPrefs.dataPageSize.subscribe((x) => {
      this.tableInput.pageSize = x;
    });

    this.appDescSubs = this._g.appDescription.subscribe((x) => {
      if (x === null) {
        return;
      }
      this.dataModelSubs = this._g.dataModel.subscribe((x2) => {
        if (x2 === null) {
          return;
        }
        for (const key in x2.nodes) {
          if (!TYPES_NOT_TO_SHOW.includes(key)) {
            this.classOptions.push({ text: key, isDisabled: false });
            if (this.selectedClassProps.length == 0) {
              this.selectedClassProps = Object.keys(x2.nodes[key]);
            }
          }
        }

        for (const key in x2.edges) {
          if (!TYPES_NOT_TO_SHOW.includes(key)) {
            this.classOptions.push({ text: key, isDisabled: false });
          }
        }

        this.setCurrRulesFromLocalStorage();
        let i = this.getEditingRuleIdx();
        if (i > -1) {
          this.currRules[i].isEditing = false; // simulate click
          this.editRule(i);
        } else {
          this.newRuleClick();
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.loadFromFileSubs) {
      this.loadFromFileSubs.unsubscribe();
    }
    if (this.dataPageSizeSubs) {
      this.dataPageSizeSubs.unsubscribe();
    }
    if (this.appDescSubs) {
      this.appDescSubs.unsubscribe();
    }
    if (this.dataModelSubs) {
      this.dataModelSubs.unsubscribe();
    }
  }

  private setCurrRulesFromLocalStorage() {
    if (this._profile.isStoreProfile()) {
      let storedRules = this._profile.getQueryRules();
      for (const m of storedRules) {
        this._profile.addParents(m.rules.rules);
      }
      this.currRules = storedRules;
    }
  }

  changeSelectedClass() {
    const txt = this.selectedClass;
    const properties = this._g.dataModel.getValue();
    let isNodeClassSelected: boolean = properties.nodes.hasOwnProperty(txt);
    let isEdgeClassSelected: boolean = properties.edges.hasOwnProperty(txt);
    this.selectedClassProps.length = 0;
    this.selectedClassProps.push(GENERIC_TYPE.NOT_SELECTED);
    let isGeneric = false;
    if (isNodeClassSelected) {
      this.selectedClassProps.push(...Object.keys(properties.nodes[txt]));
      this.selectedClassProps.push(...this.getEdgeTypesRelated(txt));
      isGeneric = false;
    } else if (isEdgeClassSelected) {
      this.selectedClassProps.push(...Object.keys(properties.edges[txt]));
      isGeneric = false;
    } else {
      isGeneric = true;
    }
    // update query rule if it exists
    if (this.queryRule) {
      this.queryRule.className = this.selectedClass;
      this.queryRule.isEdge = isEdgeClassSelected;
    }

    setTimeout(() => {
      this.currProperties.next({
        properties: this.selectedClassProps,
        isGenericTypeSelected: isGeneric,
        selectedClass: this.selectedClass,
      });
    }, 0);
  }

  private getEdgeTypesRelated(nodeType: string): string[] {
    let r: string[] = [];
    const a = this._g.appDescription.getValue();
    const txt = this.selectedClass.toLowerCase();
    for (let k of Object.keys(a.relations)) {
      const v = a.relations[k];
      if (v.source.toLowerCase() == txt || v.target.toLowerCase() == txt) {
        r.push(k);
      }
    }
    return r;
  }

  initRules(s: "AND" | "OR" | "C") {
    this.editingPropertyRule = null;
    const properties = this._g.dataModel.getValue();
    const isEdge = properties.edges[this.selectedClass] != undefined;
    if (s == "AND" || s == "OR") {
      this.queryRule = {
        className: this.selectedClass,
        isEdge: isEdge,
        rules: { r: { ruleOperator: s }, children: [], parent: null },
      };
    } else if (s == "C") {
      this.queryRule = {
        className: this.selectedClass,
        isEdge: isEdge,
        rules: { r: null, children: [], parent: null },
      };
    }
    this.currRuleNode = this.queryRule.rules;
    this.changeSelectedClass();
  }

  addRule2QueryRules(r: Rule) {
    if (this.currRuleNode.r) {
      if (this.currRuleNode.isEditing) {
        this.currRuleNode.r = r;
        this.editedRuleNode.next(this.currRuleNode);
      } else {
        this.currRuleNode.children.push({
          r: r,
          children: [],
          parent: this.currRuleNode,
        });
      }
    } else {
      // if "Condition" is clicked at the start
      this.currRuleNode.r = r;
    }
    this.isClassTypeLocked = true;
    this.isShowPropertyRule = r.ruleOperator !== null;
  }

  showPropertyRule(e: { node: RuleNode; isEdit: boolean }) {
    this.currRuleNode = e.node;
    // means edit is clicked in rule tree
    if (!e.isEdit) {
      this.isShowPropertyRule = true;
      this.changeSelectedClass();
      return;
    }
    this.isShowPropertyRule = false;
    // let the UI for property rule re-rendered
    setTimeout(() => {
      this.isShowPropertyRule = e.node.isEditing;
      this.changeSelectedClass();
      if (e.node.isEditing) {
        this.editingPropertyRule = e.node.r;
      } else {
        this.editingPropertyRule = null;
      }
    });
  }

  newOperator(e: RuleNode) {
    this.isShowPropertyRule = true;
    this.currRuleNode = e;
  }

  queryRuleDeleted() {
    this.isClassTypeLocked = false;
    this.queryRule.rules = null;
    this.isShowPropertyRule = true;
  }

  runQueryOnClient() {
    const fnStr2 =
      getBoolExpressionFromMetric(this.queryRule) +
      " return true; return false;";

    const filterFn = new Function("x", fnStr2);
    let satisfyingElems = this._g.cy.filter(filterFn);
    satisfyingElems = satisfyingElems.union(
      this._g.filterRemovedElems(filterFn)
    );
    const newElemIndicator = this._g.userPrefs.mergedElemIndicator.getValue();
    if (
      newElemIndicator == MergedElemIndicatorTypes.highlight ||
      newElemIndicator == MergedElemIndicatorTypes.none
    ) {
      this._g.highlightElements(satisfyingElems);
    } else if (newElemIndicator == MergedElemIndicatorTypes.selection) {
      this._g.isSwitch2ObjTabOnSelect = false;
      satisfyingElems.select();
      this._g.isSwitch2ObjTabOnSelect = true;
    }
    this._g.applyClassFiltering();
  }

  runQueryOnDatabase() {
    if (!this.queryRule || Object.keys(this.queryRule).length === 0) {
      this._g.showErrorModal("Query", "There is no query!");
      return;
    }

    const isClientSidePagination =
      this._g.userPrefs.queryResultPagination.getValue() == "Client";
    const skip = (this.tableInput.currPage - 1) * this.tableInput.pageSize;
    const limit4clientSidePaginated =
      this._g.userPrefs.dataPageSize.getValue() *
      this._g.userPrefs.dataPageLimit.getValue();
    const limit = isClientSidePagination
      ? limit4clientSidePaginated
      : this.tableInput.pageSize;
    const isMerge =
      this.tableInput.isMergeGraph && this._g.cy.elements().length > 0;
    this.tableInput.currPage = 1;
    this.clearTableFilter.next(true);
    const cb2 = (x: DbResponse) => {
      this.dbResponse = x;
      const clientSideX = this.filterDbResponse(x, {
        orderBy: "",
        orderDirection: "",
        txt: "",
      });
      if (isClientSidePagination) {
        this.fillTable(clientSideX.tableData);
      } else {
        this.fillTable(x.tableData);
      }

      if (this.tableInput.isLoadGraph) {
        if (isClientSidePagination) {
          this._cyService.loadElementsFromDatabase(
            clientSideX.graphData,
            isMerge
          );
        } else {
          this._cyService.loadElementsFromDatabase(x.graphData, isMerge);
        }
      }
      if (isClientSidePagination) {
        this.tableInput.resultCnt = Math.min(
          x.count,
          limit4clientSidePaginated
        );
      } else {
        this.tableInput.resultCnt = x.count;
      }
    };
    this._dbService.getFilteringResult(
      this.queryRule,
      null,
      skip,
      limit,
      DbResponseType.table,
      cb2
    );
  }

  // used for client-side filtering, assumes tableData and graphData arrays are parallel (index i corresponds to the same element)
  private filterDbResponse(d: DbResponse, filter: TableFiltering): DbResponse {
    const pageSize = this._g.userPrefs.dataPageSize.getValue();
    const pageLimit = this._g.userPrefs.dataPageLimit.getValue();
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const r: DbResponse = {
      count: pageSize * pageLimit,
      graphData: { nodes: [], edges: [] },
      tableData: { columns: d.tableData.columns, data: [] },
    };
    let tmpData: { graph: any; table: any }[] = [];
    for (let i = 0; i < d.tableData.data.length; i++) {
      const vals = Object.values(d.tableData.data[i][1]).join("");
      if (
        (isIgnoreCase &&
          vals.toLowerCase().includes(filter.txt.toLowerCase())) ||
        (!isIgnoreCase && vals.includes(filter.txt))
      ) {
        if (this.queryRule.isEdge) {
          tmpData.push({
            table: d.tableData.data[i],
            graph: d.graphData.edges[i],
          });
        } else {
          tmpData.push({
            table: d.tableData.data[i],
            graph: d.graphData.nodes[i],
          });
        }
      }
    }
    // order by
    if (filter.orderDirection.length > 0) {
      const o = filter.orderBy;
      if (filter.orderDirection == "asc") {
        tmpData = tmpData.sort((a, b) => {
          if (a.table[1][o] > b.table[1][o]) return 1;
          if (b.table[1][o] > a.table[1][o]) return -1;
          return 0;
        });
      } else {
        tmpData = tmpData.sort((a, b) => {
          if (a.table[1][o] < b.table[1][o]) return 1;
          if (b.table[1][o] < a.table[1][o]) return -1;
          return 0;
        });
      }
    }
    const skip = filter.skip ? filter.skip : 0;
    r.count = tmpData.length;
    tmpData = tmpData.slice(skip, skip + pageSize);
    r.tableData.data = tmpData.map((x) => x.table);
    if (this.queryRule.isEdge) {
      r.graphData.edges = tmpData.map((x) => x.graph);
      for (let i = 0; i < r.graphData.edges.length; i++) {
        const srcId = r.graphData.edges[i].startNodeElementId;
        const tgtId = r.graphData.edges[i].endNodeElementId;
        r.graphData.nodes.push(
          d.graphData.nodes.find((x) => x.elementId == srcId)
        );
        r.graphData.nodes.push(
          d.graphData.nodes.find((x) => x.elementId == tgtId)
        );
      }
    } else {
      r.graphData.nodes = tmpData.map((x) => x.graph);
    }
    return r;
  }

  private fillTable(data) {
    this.tableInput.results = [];
    if (data.data[0] === undefined || data.data[0][1] === undefined) {
      this.tableFilled.next(true);
      return;
    }

    this.tableInput.isNodeData = !this.queryRule.isEdge;
    const properties = this._g.dataModel.getValue();
    if (this.tableInput.isNodeData) {
      this.tableInput.columns = Object.keys(
        properties["nodes"][this.selectedClass]
      );
    } else {
      this.tableInput.columns = Object.keys(
        properties["edges"][this.selectedClass]
      );
    }

    for (let i = 0; i < data.data.length; i++) {
      if (
        data.data[i] === null ||
        data.data[i] === undefined ||
        data.data[i][0] === undefined ||
        data.data[i][0] === null
      ) {
        continue;
      }
      // first column is ID
      let d: TableData[] = [
        { val: data.data[i][0], type: TableDataType.string },
      ];
      for (let [k, v] of Object.entries(data.data[i][1])) {
        let idx = this.tableInput.columns.indexOf(k);
        if (idx > -1) {
          const enumMapping = this._g.getEnumMapping();
          d[idx + 1] = property2TableData(
            properties,
            enumMapping,
            k,
            v,
            this.queryRule.className,
            this.queryRule.isEdge
          );
        }
      }
      for (let j = 0; j < this.tableInput.columns.length + 1; j++) {
        if (!d[j]) {
          d[j] = { val: "", type: TableDataType.string };
        }
      }
      this.tableInput.results.push(d);
    }
    this.tableFilled.next(true);
  }

  runQuery() {
    if (this.isQueryOnDb) {
      this.dbResponse = null;
      this.runQueryOnDatabase();
    } else {
      this.runQueryOnClient();
    }
  }

  filterElesByClass(e: { className: string; willBeShowed: boolean }) {
    if (e.willBeShowed) {
      this._g.hiddenClasses.delete(e.className);
      this._g.viewUtils.show(this._g.cy.$("." + e.className));
    } else {
      this._g.hiddenClasses.add(e.className);
      this._g.viewUtils.hide(this._g.cy.$("." + e.className));
    }
    this.filter4Collapsed(e.className, e.willBeShowed);
    this._g.shownElemsChanged.next(true);
    this._g.performLayout(false);
  }

  private filter4Collapsed(className: string, isShow: boolean) {
    const classCSS = "." + className;

    // apply filter to collapsed nodes, if they are not collapsed it should be already applied
    const clusterNodes = this._g.cy.nodes("." + CLUSTER_CLASS);
    for (let i = 0; i < clusterNodes.length; i++) {
      this.filter4CompoundNode(clusterNodes[i], classCSS, isShow);
    }

    // apply filter to collapsed edges, if they are not collapsed it should be already applied
    const compoundEdges = this._g.cy.edges("." + COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < compoundEdges.length; i++) {
      this.filter4CompoundEdge(compoundEdges[i], classCSS, isShow);
    }
    this._g.handleCompoundsOnHideDelete();
  }

  private filter4CompoundNode(node, classCSS: string, isShow: boolean) {
    let children = node.children(); // a node might have children
    const collapsed = node.data("collapsedChildren"); // a node might a collapsed
    if (collapsed) {
      children = children.union(collapsed);
    }
    for (let i = 0; i < children.length; i++) {
      if (isShow) {
        this._g.viewUtils.show(children[i].filter(classCSS));
      } else {
        this._g.viewUtils.hide(children[i].filter(classCSS));
      }
    }
    // recursively apply for complex children
    const compoundNodes = children.filter("." + CLUSTER_CLASS);
    for (let i = 0; i < compoundNodes.length; i++) {
      this.filter4CompoundNode(compoundNodes[i], classCSS, isShow);
    }
    // a compound node might also have compound edges
    const compoundEdges = children.filter("." + COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < compoundEdges.length; i++) {
      this.filter4CompoundEdge(compoundEdges[i], classCSS, isShow);
    }
  }

  private filter4CompoundEdge(edge, classCSS: string, isShow: boolean) {
    const children = edge.data("collapsedEdges"); // a node might have children
    for (let i = 0; i < children.length; i++) {
      if (isShow) {
        this._g.viewUtils.show(children[i].filter(classCSS));
      } else {
        this._g.viewUtils.hide(children[i].filter(classCSS));
      }
    }
    // recursively apply for complex children
    const complexes = children.filter("." + COLLAPSED_EDGE_CLASS);
    for (let i = 0; i < complexes.length; i++) {
      this.filter4CompoundEdge(complexes[i], classCSS, isShow);
    }
  }

  getDataForQueryResult(e: TableRowMeta) {
    let fn = (x: any) => {
      this._cyService.loadElementsFromDatabase(x, this.tableInput.isMergeGraph);
    };
    let historyMeta: HistoryMetaData = {
      customTxt: "Loaded from table: ",
      isNode: !this.queryRule.isEdge,
      labels: e.tableIdx.join(","),
    };
    if (
      this._g.userPrefs.queryResultPagination.getValue() == "Client" &&
      this.dbResponse
    ) {
      const isMerge =
        this.tableInput.isMergeGraph && this._g.cy.elements().length > 0;
      let r: GraphResponse = {
        nodes: this.dbResponse.graphData.nodes.filter(
          (x) => e.dbIds.findIndex((a) => a == x.elementId) > -1
        ),
        edges: [],
      };
      if (this.queryRule.isEdge) {
        const edges = this.dbResponse.graphData.edges.filter(
          (x) => e.dbIds.findIndex((a) => a == x.elementId) > -1
        );
        const nodes = [];
        for (let i = 0; i < edges.length; i++) {
          const n1 = this.dbResponse.graphData.nodes.find(
            (x) => x.elementId == edges[i].startNodeElementId
          );
          const n2 = this.dbResponse.graphData.nodes.find(
            (x) => x.elementId == edges[i].endNodeElementId
          );
          nodes.push(n1, n2);
        }
        r = { edges: edges, nodes: nodes };
      }
      this._cyService.loadElementsFromDatabase(r, isMerge);
    } else {
      this._dbService.getElems(
        e.dbIds,
        fn,
        { isEdgeQuery: this.queryRule.isEdge },
        historyMeta
      );
    }
  }

  resetRule() {
    this.queryRule = null;
    this.tableInput = {
      columns: [],
      tableTitle: "Query Results",
      results: [],
      resultCnt: 0,
      currPage: 1,
      pageSize: this.tableInput.pageSize,
      isShowExportAsCSV: true,
      isEmphasizeOnHover: true,
      isLoadGraph: false,
      isMergeGraph: true,
      isNodeData: true,
      isReplace_inHeaders: true,
    };
    this.isClassTypeLocked = false;
    this.selectedClass = this.classOptions[0].text;
    this.changeSelectedClass();
  }

  groupTabCliked() {
    this.isGroupTabOpen = !this.isGroupTabOpen;
    if (this.isGroupTabOpen) {
      this.groupComponent.componentOpened();
    }
  }

  filterTable(filter: TableFiltering) {
    const cb2 = (x: DbResponse) => {
      const isMerge =
        this.tableInput.isMergeGraph && this._g.cy.elements().length > 0;
      this.fillTable(x.tableData);
      if (this.tableInput.isLoadGraph) {
        this._cyService.loadElementsFromDatabase(
          x.graphData as GraphResponse,
          isMerge
        );
      }
      this.tableInput.resultCnt = x.count;
    };
    this.tableInput.currPage = 1;
    if (this._g.userPrefs.queryResultPagination.getValue() == "Client") {
      cb2(this.filterDbResponse(this.dbResponse, filter));
    } else {
      const limit = this.tableInput.pageSize;
      let skip = filter.skip ? filter.skip : 0;
      this._dbService.getFilteringResult(
        this.queryRule,
        filter,
        skip,
        limit,
        DbResponseType.table,
        cb2
      );
    }
  }

  editRule(i: number) {
    let curr = this.currRules[i];
    this.isShowPropertyRule = false;
    if (curr.isEditing) {
      return;
    }
    this.isAddingNewRule = false;
    this.changeBtnTxt = "Update";
    this.resetRule();
    this.resetEditingRules();
    curr.isEditing = true;
    // this.queryRule2 = { className: curr.rules.className, isEdge: curr.rules.isEdge, rules: deepCopyRuleNode(curr.rules.rules) };
    this.queryRule = curr.rules;
    this.currRuleName = curr.name;
    this.isQueryOnDb = curr.isOnDb;
    this.tableInput.isMergeGraph = curr.isMergeGraph;
    this.tableInput.isLoadGraph = curr.isLoadGraph;
    this.selectedClass = this.queryRule.className;
    this.changeSelectedClass();
    this.isClassTypeLocked = true;
  }

  resetEditingRules() {
    for (let i = 0; i < this.currRules.length; i++) {
      this.currRules[i].isEditing = false;
      this.clearAllEditings(this.currRules[i].rules.rules);
    }
  }

  clearAllEditings(r: RuleNode) {
    if (r === undefined || r === null) {
      return;
    }
    r.isEditing = false;
    for (const child of r.children) {
      this.clearAllEditings(child);
    }
  }

  deleteRule(i: number) {
    this.currRules.splice(i, 1);
    if (this.currRules.length < 1) {
      this.newRuleClick();
    }
    this._profile.saveQueryRules(this.currRules);
  }

  newRuleClick() {
    this.isAddingNewRule = true;
    this.changeBtnTxt = "Add";
    this.currRuleName = "New rule";
    this.isShowPropertyRule = true;
    this.resetEditingRules();
    this.resetRule();
  }

  private updateRule() {
    let idx = this.getEditingRuleIdx();
    this.currRules[idx].rules = {
      className: this.queryRule.className,
      isEdge: this.queryRule.isEdge,
      rules: deepCopyRuleNode(this.queryRule.rules),
    };
    this.currRules[idx].name = this.currRuleName;
    this.currRules[idx].isLoadGraph = this.tableInput.isLoadGraph;
    this.currRules[idx].isMergeGraph = this.tableInput.isMergeGraph;
    this.currRules[idx].isOnDb = this.isQueryOnDb;
  }

  private getEditingRuleIdx(): number {
    for (let i = 0; i < this.currRules.length; i++) {
      if (this.currRules[i].isEditing) {
        return i;
      }
    }
    return -1;
  }

  private addRule() {
    if (this.queryRule == null || this.queryRule == undefined) {
      return;
    }
    this.resetEditingRules();
    this.currRules.push({
      rules: {
        className: this.queryRule.className,
        isEdge: this.queryRule.isEdge,
        rules: deepCopyRuleNode(this.queryRule.rules),
      },
      name: this.currRuleName,
      isEditing: true,
      isOnDb: this.isQueryOnDb,
      isLoadGraph: this.tableInput.isLoadGraph,
      isMergeGraph: this.tableInput.isMergeGraph,
    });
    this.isAddingNewRule = false;
    this.changeBtnTxt = "Update";
  }

  addOrUpdateRule() {
    if (this.isAddingNewRule) {
      this.addRule();
    } else {
      this.updateRule();
    }
    this._profile.saveQueryRules(this.currRules);
  }
}
