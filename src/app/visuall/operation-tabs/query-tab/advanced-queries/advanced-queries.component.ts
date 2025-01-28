import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Subject, Subscription } from "rxjs";
import { FileReaderService } from "src/app/visuall/file-reader.service";
import {
  TableData,
  TableFiltering,
  TableRowMeta,
  TableViewInput,
} from "../../../../shared/table-view/table-view-types";
import { getCyStyleFromColorAndWid, isJson } from "../../../constants";
import { CytoscapeService } from "../../../cytoscape.service";
import {
  DbResponseType,
  ElementAsQueryParam,
  GraphElement,
  Neo4jEdgeDirection,
} from "../../../db-service/data-types";
import { DbAdapterService } from "../../../db-service/db-adapter.service";
import { GlobalVariableService } from "../../../global-variable.service";

@Component({
  selector: "app-advanced-queries",
  templateUrl: "./advanced-queries.component.html",
  styleUrls: ["./advanced-queries.component.css"],
})
export class AdvancedQueriesComponent implements OnInit, OnDestroy {
  @ViewChild("file", { static: false }) file: any;
  queries: string[];
  selectedQuery: string;
  selectedIndex: number;
  nodeEdgeClasses: string[] = [];
  ignoredTypes: string[] = [];
  lengthLimit = 2;
  isDirected = true;
  selectedNodes: ElementAsQueryParam[] = [];
  selectedClass = "";
  targetOrRegulator = 0;
  clickedNodeIndex = -1;
  addNodeButtonTxt = "Select Nodes to Add";
  tableInput: TableViewInput = {
    columns: ["Title"],
    results: [],
    isEmphasizeOnHover: true,
    tableTitle: "Query Results",
    isShowExportAsCSV: true,
    resultCount: 0,
    currentPage: 1,
    pageSize: 0,
    isLoadGraph: false,
    isMergeGraph: true,
    isNodeData: true,
    allChecked: false,
  };
  tableFilter: TableFiltering = {
    orderBy: null,
    orderDirection: null,
    txt: "",
    skip: null,
  };
  tableFilled = new Subject<boolean>();
  dataPageSizeSubscription: Subscription;
  dataModelSubscription: Subscription;
  dbResponse = null;

  constructor(
    private _g: GlobalVariableService,
    private _dbService: DbAdapterService,
    private _cyService: CytoscapeService,
    private _fileReaderService: FileReaderService
  ) {
    this.queries = [
      "Get neighborhood",
      "Get graph of interest",
      "Get common targets/regulators",
    ];
    this.selectedIndex = -1;
  }

  ngOnInit(): void {
    this.dataModelSubscription = this._g.dataModel.subscribe((x) => {
      if (x) {
        for (const n in x.nodes) {
          this.nodeEdgeClasses.push(n);
        }
        for (const e in x.edges) {
          this.nodeEdgeClasses.push(e);
        }
      }
    });
    this.selectedQuery = "";
    this.dataPageSizeSubscription =
      this._g.userPreferences.dataPageSize.subscribe((x) => {
        this.tableInput.pageSize = x;
        this.tableInput.currentPage = 1;
        this.tableFilter.skip = 0;
      });
  }

  ngOnDestroy(): void {
    if (this.dataModelSubscription) {
      this.dataModelSubscription.unsubscribe();
    }
    if (this.dataPageSizeSubscription) {
      this.dataPageSizeSubscription.unsubscribe();
    }
  }

  changeAdvancedQuery(event: any) {
    this.selectedIndex = this.queries.findIndex((x) => x == event.target.value);
  }

  addSelectedNodes() {
    if (this._g.isSwitch2ObjectTabOnSelect) {
      this._g.isSwitch2ObjectTabOnSelect = false;
      this.addNodeButtonTxt = "Complete Selection";
      return;
    }
    this.addNodeButtonTxt = "Select Nodes to Add";
    this._g.isSwitch2ObjectTabOnSelect = true;
    const selectedNodes = this._g.cy.nodes(":selected");
    if (selectedNodes.length < 1) {
      return;
    }
    const dbIds = selectedNodes.map((x: any) => x.id().slice(1));
    const labels = this._g.getLabels4ElementsAsArray(dbIds);
    const types = selectedNodes.map((x: any) => x.classes()[0]);
    for (let i = 0; i < labels.length; i++) {
      if (this.selectedNodes.findIndex((x) => x.dbId == dbIds[i]) < 0) {
        this.selectedNodes.push({
          dbId: dbIds[i],
          label: types[i] + ":" + labels[i],
        });
      }
    }
  }

  removeSelected(i: number) {
    if (i == this.clickedNodeIndex) {
      this.clickedNodeIndex = -1;
      const idSelector = "n" + this.selectedNodes[i].dbId;
      this._g.cy.$id(idSelector).unselect();
    } else if (i < this.clickedNodeIndex) {
      this.clickedNodeIndex--;
    }
    this.selectedNodes.splice(i, 1);
  }

  removeAllSelectedNodes() {
    this.selectedNodes = [];
    this.clickedNodeIndex = -1;
  }

  runQuery(isFromFilter: boolean, idFilter: (string | number)[] | null) {
    if (!isFromFilter && !idFilter) {
      this.tableFilter.skip = 0;
      this.tableInput.currentPage = 1;
    }
    const dbIds = this.selectedNodes.map((x) => x.dbId);
    if (dbIds.length < 1) {
      return;
    }
    const isClientSidePagination =
      this._g.userPreferences.queryResultPagination.getValue() == "Client";
    const prepareDataFn = (x: any) => {
      if (!idFilter && !isFromFilter) {
        this.dbResponse = x;
      }

      if (!idFilter) {
        if (isClientSidePagination) {
          const clientSideX = this.filterDbResponse(
            x,
            isFromFilter ? this.tableFilter : null,
            idFilter
          );
          this.fillTable(clientSideX, !isFromFilter, isClientSidePagination);
        } else {
          this.fillTable(x, !isFromFilter, isClientSidePagination);
        }
      }
      if (this.tableInput.isLoadGraph || idFilter) {
        if (isClientSidePagination) {
          const clientSideX = this.filterDbResponse(
            x,
            isFromFilter ? this.tableFilter : null,
            idFilter
          );
          this._cyService.loadElementsFromDatabase(
            this.prepareElements4Cy(clientSideX),
            this.tableInput.isMergeGraph
          );
        } else {
          this._cyService.loadElementsFromDatabase(
            this.prepareElements4Cy(x),
            this.tableInput.isMergeGraph
          );
        }
        this.highlightSeedNodes();
        this.highlightTargetRegulators(x);
      }
    };
    if (isFromFilter && isClientSidePagination) {
      prepareDataFn(this.dbResponse);
    } else {
      const types = this.ignoredTypes.map((x) => `'${x}'`);
      if (this.selectedIndex == 1) {
        this._dbService.getGraphOfInterest(
          dbIds,
          types,
          this.lengthLimit,
          this.isDirected,
          DbResponseType.table,
          this.tableFilter,
          idFilter,
          prepareDataFn
        );
      } else if (this.selectedIndex == 2) {
        let dir: Neo4jEdgeDirection = this.targetOrRegulator;
        if (!this.isDirected) {
          dir = Neo4jEdgeDirection.BOTH;
        }
        this._dbService.getCommonStream(
          dbIds,
          types,
          this.lengthLimit,
          dir,
          DbResponseType.table,
          this.tableFilter,
          idFilter,
          prepareDataFn
        );
      } else if (this.selectedIndex == 0) {
        this._dbService.getNeighborhood(
          dbIds,
          types,
          this.lengthLimit,
          this.isDirected,
          this.tableFilter,
          idFilter,
          prepareDataFn
        );
      }
    }
  }

  setSelected(x: ElementAsQueryParam[]) {
    this.selectedNodes = x;
  }

  // used for client-side filtering
  private filterDbResponse(
    x: any,
    filter: TableFiltering,
    idFilter: (string | number)[]
  ) {
    const r = {
      columns: x.columns,
      data: [[null, null, null, null, null, null, null, null]],
    };
    const indexNodes = x.columns.indexOf("nodes");
    const indexNodeId = x.columns.indexOf("nodeElementId");
    const indexNodeClass = x.columns.indexOf("nodeClass");
    const indexEdges = x.columns.indexOf("edges");
    const indexEdgeId = x.columns.indexOf("edgeElementId");
    const indexEdgeClass = x.columns.indexOf("edgeClass");
    const indexEdgeSourceTarget = x.columns.indexOf("edgeSourceTargets");
    const idxTotalCnt = x.columns.indexOf("totalNodeCount");
    const maxResultCnt =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.dataPageSize.getValue();

    const nodes = x.data[0][indexNodes];
    const nodeClass = x.data[0][indexNodeClass];
    const nodeId = x.data[0][indexNodeId];
    const edges = x.data[0][indexEdges];
    const edgeClass = x.data[0][indexEdgeClass];
    const edgeId = x.data[0][indexEdgeId];
    const edgeSourceTarget = x.data[0][indexEdgeSourceTarget];
    r.data[0][indexEdges] = edges;
    r.data[0][indexEdgeClass] = edgeClass;
    r.data[0][indexEdgeId] = edgeId;
    r.data[0][indexEdgeSourceTarget] = edgeSourceTarget;
    r.data[0][idxTotalCnt] =
      x.data[0][idxTotalCnt] > maxResultCnt
        ? maxResultCnt
        : x.data[0][idxTotalCnt];

    const isIgnoreCase = this._g.userPreferences.isIgnoreCaseInText.getValue();

    let tempNodes: { node: any; cls: string; elementId: string }[] = [];
    const srcNodeIds = this.selectedNodes.map((x) => x.dbId);
    if (idFilter) {
      tempNodes = nodes
        .map((_: any, i: number) => {
          return { node: nodes[i], cls: nodeClass[i], elementId: nodeId[i] };
        })
        .filter((_: any, i: number) => {
          return (
            idFilter.includes(nodeId[i]) ||
            srcNodeIds.findIndex((x) => x == nodeId[i]) > -1
          );
        });
    } else if (filter) {
      for (let i = 0; i < nodes.length; i++) {
        const values = Object.values(nodes[i]).join("");
        // always include source nodes
        if (
          srcNodeIds.includes(nodeId[i]) ||
          (isIgnoreCase &&
            values.toLowerCase().includes(filter.txt.toLowerCase())) ||
          (!isIgnoreCase && values.includes(filter.txt))
        ) {
          tempNodes.push({
            node: nodes[i],
            cls: nodeClass[i],
            elementId: nodeId[i],
          });
        }
      }
    } else {
      tempNodes = nodes.map((_: any, i: number) => {
        return { node: nodes[i], cls: nodeClass[i], elementId: nodeId[i] };
      });
    }

    // order by
    if (!idFilter && filter && filter.orderDirection.length > 0) {
      const o = filter.orderBy;
      if (filter.orderDirection == "asc") {
        tempNodes = tempNodes.sort((a, b) => {
          if (!a.node[o]) return 1;
          if (!b.node[o]) return -1;
          if (a.node[o] > b.node[o]) return 1;
          if (b.node[o] > a.node[o]) return -1;
          return 0;
        });
      } else {
        tempNodes = tempNodes.sort((a, b) => {
          if (!a.node[o]) return 1;
          if (!b.node[o]) return -1;
          if (a.node[o] < b.node[o]) return 1;
          if (b.node[o] < a.node[o]) return -1;
          return 0;
        });
      }
    }
    const skip = filter && filter.skip ? filter.skip : 0;
    for (let i = 0; i < srcNodeIds.length; i++) {
      const index = tempNodes.findIndex((x) => x.elementId == srcNodeIds[i]);
      // move src node to the beginning
      if (index > -1) {
        const tmp = tempNodes[index];
        tempNodes[index] = tempNodes[i];
        tempNodes[i] = tmp;
      }
    }
    if (filter && !idFilter) {
      this.tableInput.resultCount = tempNodes.length;
    }

    tempNodes = tempNodes.slice(
      skip,
      skip + this._g.userPreferences.dataPageSize.getValue()
    );
    r.data[0][indexNodes] = tempNodes.map((x) => x.node);
    r.data[0][indexNodeClass] = tempNodes.map((x) => x.cls);
    r.data[0][indexNodeId] = tempNodes.map((x) => x.elementId);
    return r;
  }

  // fill table from graph response
  private fillTable(
    data: any,
    isRefreshColumns = true,
    isClientSidePagination = true
  ) {
    const indexNodes = data.columns.indexOf("nodes");
    const indexNodeId = data.columns.indexOf("nodeElementId");
    const indexNodeClass = data.columns.indexOf("nodeClass");
    const idxTotalCnt = data.columns.indexOf("totalNodeCount");
    const nodes = data.data[0][indexNodes];
    const nodeClass = data.data[0][indexNodeClass];
    const nodeId = data.data[0][indexNodeId];
    if (isRefreshColumns || !isClientSidePagination) {
      this.tableInput.resultCount = data.data[0][idxTotalCnt];
    }

    this.tableInput.results = [];
    if (isRefreshColumns) {
      this.tableInput.columns = [];
    }
    this.tableInput.classNames = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i];
      delete d["tconst"];
      delete d["nconst"];
      const propNames = Object.keys(d);
      const row: TableData[] = [{ value: nodeId[i] }];
      for (const n of propNames) {
        const index = this.tableInput.columns.indexOf(n);
        if (index == -1) {
          this.tableInput.columns.push(n);
          row[this.tableInput.columns.length] = { value: d[n] };
        } else {
          row[index + 1] = { value: d[n] };
        }
      }
      // fill empty columns
      for (let j = 0; j < this.tableInput.columns.length + 1; j++) {
        if (!row[j]) {
          row[j] = { value: "" };
        }
      }
      this.tableInput.classNames.push(nodeClass[i]);
      this.tableInput.results.push(row);
    }

    const maxColCnt = Math.max(...this.tableInput.results.map((x) => x.length));
    for (let i = 0; i < this.tableInput.results.length; i++) {
      for (let j = this.tableInput.results[i].length; j < maxColCnt; j++) {
        this.tableInput.results[i].push({
          value: "",
        });
      }
    }
    this.tableFilled.next(true);
  }

  private highlightSeedNodes() {
    const dbIds = new Set(this.selectedNodes.map((x) => x.dbId));
    const seedNodes = this._g.cy
      .nodes()
      .filter((node: any) => dbIds.has(node.id().substring(1)));
    // add a new higlight style
    if (this._g.userPreferences.highlightStyles.length < 2) {
      const cyStyle = getCyStyleFromColorAndWid("#0b9bcd", 4.5);
      this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    }
    const currHighlightIdx =
      this._g.userPreferences.currHighlightIdx.getValue();
    if (currHighlightIdx == 0) {
      this._g.viewUtils.highlight(seedNodes, 1);
    } else {
      this._g.viewUtils.highlight(seedNodes, 0);
    }
  }

  private highlightTargetRegulators(data) {
    const idxTargetRegulator = data.columns.indexOf("targetRegulatorNodeIds");
    const dbIds = new Set(data.data[0][idxTargetRegulator]);
    if (!dbIds || dbIds.size < 1) {
      return;
    }
    const cyNodes = this._g.cy
      .nodes()
      .filter((node: any) => dbIds.has(node.id().substring(1)));

    // add a new higlight style
    if (this._g.userPreferences.highlightStyles.length < 3) {
      const cyStyle = getCyStyleFromColorAndWid("#04f06a", 4.5);
      this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    }
    this._g.viewUtils.highlight(cyNodes, 2);
  }

  addSelectedNodesFromFile() {
    this.file.nativeElement.value = "";
    this.file.nativeElement.click();
  }

  fileSelected() {
    this._fileReaderService.readTxtFile(
      this.file.nativeElement.files[0],
      (txt) => {
        let elements: GraphElement[] = [];
        if (!isJson(txt)) {
          const arr = txt.split("\n").map((x) => x.split("|"));
          if (arr.length < 0) {
            return;
          }
          const idx4id = arr[0].indexOf("id");

          for (let i = 1; i < arr.length; i++) {
            if (
              this.selectedNodes.find(
                (x) => x.dbId == arr[i][idx4id].substring(1)
              )
            ) {
              continue;
            }
            const o = {};
            for (let j = 1; j < arr[0].length; j++) {
              o[arr[0][j]] = arr[i][j];
            }
            elements.push({ classes: arr[i][0], data: o });
          }
        } else {
          elements = JSON.parse(txt) as GraphElement[];
          const fn1 = (x: any) =>
            this.selectedNodes.find(
              (y) => y.dbId === x.data.id.substring(1)
            ) === undefined;
          if (!(elements instanceof Array)) {
            elements = (JSON.parse(txt).nodes as any[]).filter(fn1);
          } else {
            elements = elements.filter(
              (x) => x.data.id.startsWith("n") && fn1(x)
            );
          }
        }

        const labels = this._g.getLabels4ElementsAsArray(null, true, elements);
        this.selectedNodes = this.selectedNodes.concat(
          elements.map((x, i) => {
            return {
              dbId: x.data.id.substring(1),
              label: x.classes.split(" ")[0] + ":" + labels[i],
            };
          })
        );
      }
    );
  }

  addRemoveType(e: { className: string; willBeShowed: boolean }) {
    if (e.willBeShowed) {
      const index = this.ignoredTypes.findIndex((x) => x === e.className);
      if (index > -1) {
        this.ignoredTypes.splice(index, 1);
      }
    } else {
      if (!this.ignoredTypes.includes(e.className)) {
        this.ignoredTypes.push(e.className);
      }
    }
  }

  selectedNodeClicked(i: number) {
    this._g.isSwitch2ObjectTabOnSelect = false;
    this.clickedNodeIndex = i;
    const idSelector = "n" + this.selectedNodes[i].dbId;
    this._g.cy.$().unselect();
    this._g.cy.elements(`[id = "${idSelector}"]`).select();
    this._g.isSwitch2ObjectTabOnSelect = true;
  }

  getDataForQueryResult(e: TableRowMeta) {
    this.runQuery(true, e.dbIds);
  }

  filterTable(filter: TableFiltering) {
    this.tableFilter = filter;
    this.runQuery(true, null);
  }

  prepareElements4Cy(data: any) {
    const indexNodes = data.columns.indexOf("nodes");
    const indexNodeId = data.columns.indexOf("nodeElementId");
    const indexNodeClass = data.columns.indexOf("nodeClass");
    const indexEdges = data.columns.indexOf("edges");
    const indexEdgeId = data.columns.indexOf("edgeElementId");
    const indexEdgeClass = data.columns.indexOf("edgeClass");
    const indexEdgeSourceTarget = data.columns.indexOf("edgeSourceTargets");

    const nodes = data.data[0][indexNodes];
    const nodeClass = data.data[0][indexNodeClass];
    const nodeId = data.data[0][indexNodeId];
    const edges = data.data[0][indexEdges];
    const edgeClass = data.data[0][indexEdgeClass];
    const edgeId = data.data[0][indexEdgeId];
    const edgeSourceTarget = data.data[0][indexEdgeSourceTarget];

    const cyData = { nodes: [], edges: [] };
    const nodeIdsDictionary = {};
    for (let i = 0; i < nodes.length; i++) {
      cyData.nodes.push({
        elementId: nodeId[i],
        labels: [nodeClass[i]],
        properties: nodes[i],
      });
      nodeIdsDictionary[nodeId[i]] = true;
    }

    for (let i = 0; i < edges.length; i++) {
      const sourceId = edgeSourceTarget[i][0];
      const targetId = edgeSourceTarget[i][1];
      // check if src and target exist in cy or current data.
      const isSourceLoaded = this.tableInput.isMergeGraph
        ? this._g.cy.elements(`[id = "n${sourceId}"]`).length > 0
        : false;
      const isTgtLoaded = this.tableInput.isMergeGraph
        ? this._g.cy.elements(`[id = "n${targetId}"]`).length > 0
        : false;
      if (
        (nodeIdsDictionary[sourceId] || isSourceLoaded) &&
        (nodeIdsDictionary[targetId] || isTgtLoaded)
      ) {
        cyData.edges.push({
          properties: edges[i],
          startNodeElementId: sourceId,
          endNodeElementId: targetId,
          elementId: edgeId[i],
          type: edgeClass[i],
        });
      }
    }

    return cyData;
  }
}
