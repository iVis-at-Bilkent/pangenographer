import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import {
  DbResponseType,
  GraphResponse,
} from "src/app/visuall/db-service/data-types";
import {
  TableData,
  TableDataType,
  TableFiltering,
  TableRowMeta,
  TableViewInput,
} from "../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../visuall/cytoscape.service";
import { Neo4jDb } from "../../../visuall/db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../visuall/global-variable.service";
import {
  buildIdFilter,
  getOrderByExpression4Query,
  getQueryCondition4TxtFilter,
} from "../query-helper";

export interface ActorCountData {
  id: string;
  Actor: string;
  Count: number;
}
@Component({
  selector: "app-query0",
  templateUrl: "./query0.component.html",
  styleUrls: ["./query0.component.css"],
})
export class Query0Component implements OnInit {
  movieCnt: number;
  tableFilled = new Subject<boolean>();
  tableInput: TableViewInput = {
    columns: ["Actor", "Count"],
    results: [],
    tableTitle: "Query Results",
    isEmphasizeOnHover: true,
    classNameOfObjects: "Person",
    isShowExportAsCSV: true,
    resultCnt: 0,
    currPage: 1,
    pageSize: 0,
    isLoadGraph: false,
    isMergeGraph: true,
    isNodeData: true,
  };
  tableResponse = null;
  graphResponse = null;
  clearTableFilter = new Subject<boolean>();

  constructor(
    private _dbService: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this.movieCnt = 40;
    this._g.userPrefs.dataPageSize.subscribe((x) => {
      this.tableInput.pageSize = x;
    });
  }

  prepareQuery() {
    this.tableInput.currPage = 1;
    this.clearTableFilter.next(true);
    const skip = (this.tableInput.currPage - 1) * this.tableInput.pageSize;
    this.loadTable(skip);
    this.loadGraph(skip);
  }

  loadTable(skip: number, filter?: TableFiltering) {
    const isClientSidePagination =
      this._g.userPrefs.queryResultPagination.getValue() == "Client";

    const cb = (x) => {
      const processedTableData = this.preprocessTableData(x);
      if (isClientSidePagination) {
        this.fillTable(
          this.filterTableResponse(processedTableData, filter),
          x.data[0][3]
        );
      } else {
        this.fillTable(processedTableData, x.data[0][3]);
      }
      if (!filter) {
        this.tableResponse = processedTableData;
      }
    };
    if (isClientSidePagination && filter) {
      this.fillTable(
        this.filterTableResponse(this.tableResponse, filter),
        null
      );
      return;
    }
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const txtCondition = getQueryCondition4TxtFilter(
      filter,
      ["n.primary_name", "degree"],
      isIgnoreCase
    );
    const ui2Db = { Actor: "Actor", Count: "Count" };
    const orderExpr = getOrderByExpression4Query(
      filter,
      "degree",
      "desc",
      ui2Db
    );
    const dateFilter = this.getDateRangeCQL();
    let dataCnt = this.tableInput.pageSize;
    if (isClientSidePagination) {
      dataCnt =
        this._g.userPrefs.dataPageLimit.getValue() *
        this._g.userPrefs.dataPageSize.getValue();
    }
    const r = `[${skip}..${skip + dataCnt}]`;
    const cql = `MATCH (n:Person)-[r:ACTOR|ACTRESS]->(:Title)
    WHERE ${dateFilter}
    WITH n, SIZE(COLLECT(r)) as degree
    WHERE degree >= ${this.movieCnt} ${txtCondition}
    WITH n, degree ORDER BY ${orderExpr}
    RETURN collect(ElementId(n))${r} as id, collect(n.primary_name)${r} as Actor, collect(degree)${r} as Count, size(collect(ElementId(n))) as totalDataCount`;
    this._dbService.runQuery(cql, cb, DbResponseType.table);
  }

  loadGraph(skip: number, filter?: TableFiltering) {
    if (!this.tableInput.isLoadGraph) {
      return;
    }
    const isClientSidePagination =
      this._g.userPrefs.queryResultPagination.getValue() == "Client";

    const cb = (x) => {
      if (isClientSidePagination) {
        this._cyService.loadElementsFromDatabase(
          this.filterGraphResponse(x),
          this.tableInput.isMergeGraph
        );
      } else {
        this._cyService.loadElementsFromDatabase(
          x,
          this.tableInput.isMergeGraph
        );
      }
      if (!filter || this.graphResponse == null) {
        this.graphResponse = x;
      }
    };
    if (isClientSidePagination && filter && this.graphResponse) {
      this._cyService.loadElementsFromDatabase(
        this.filterGraphResponse(this.graphResponse),
        this.tableInput.isMergeGraph
      );
      return;
    }
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const txtCondition = getQueryCondition4TxtFilter(
      filter,
      ["n.primary_name", "degree"],
      isIgnoreCase
    );
    const ui2Db = { Actor: "n.primary_name", Count: "degree" };
    const orderExpr = getOrderByExpression4Query(
      filter,
      "degree",
      "desc",
      ui2Db
    );
    const dateFilter = this.getDateRangeCQL();
    let dataCnt = this.tableInput.pageSize;
    if (isClientSidePagination) {
      dataCnt =
        this._g.userPrefs.dataPageLimit.getValue() *
        this._g.userPrefs.dataPageSize.getValue();
    }
    const cql = `MATCH (n:Person)-[r:ACTOR|ACTRESS]->(:Title)
      WHERE ${dateFilter}  
      WITH n, SIZE(COLLECT(r)) as degree, COLLECT(r) as edges
      WHERE degree >= ${this.movieCnt} ${txtCondition}
      RETURN DISTINCT n, edges, degree 
      ORDER BY ${orderExpr} SKIP ${skip} LIMIT ${dataCnt}`;
    this._dbService.runQuery(cql, cb);
  }

  fillTable(data: ActorCountData[], totalDataCount: number | null) {
    const uiColumns = ["id"].concat(this.tableInput.columns);
    const columnTypes = [
      TableDataType.number,
      TableDataType.string,
      TableDataType.number,
    ];

    this.tableInput.results = [];
    for (let i = 0; i < data.length; i++) {
      const row: TableData[] = [];
      for (let j = 0; j < uiColumns.length; j++) {
        row.push({ type: columnTypes[j], val: data[i][uiColumns[j]] });
      }
      this.tableInput.results.push(row);
    }
    if (totalDataCount) {
      this.tableInput.resultCnt = totalDataCount;
    }
    this.tableFilled.next(true);
  }

  getDataForQueryResult(e: TableRowMeta) {
    const d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    const d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    let s = `Get actors by title counts with: "${new Date(
      d1
    ).toLocaleString()}", "${new Date(d2).toLocaleString()}", "${
      this.movieCnt
    }"`;
    if (e.tableIdx) {
      s += ", " + e.tableIdx.join(",");
    }
    const cb = (x) => {
      this._cyService.loadElementsFromDatabase(x, this.tableInput.isMergeGraph);
      this._g.add2GraphHistory(s);
    };

    const idFilter = buildIdFilter(e.dbIds);
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const txtCondition = getQueryCondition4TxtFilter(
      null,
      ["n.primary_name", "degree"],
      isIgnoreCase
    );
    const ui2Db = { Actor: "n.primary_name", Count: "degree" };
    const orderExpr = getOrderByExpression4Query(null, "degree", "desc", ui2Db);
    const dateFilter = this.getDateRangeCQL();

    let cql = `MATCH (n:Person)-[r:ACTOR|ACTRESS]->(:Title)
      WHERE ${idFilter} AND ${dateFilter}  
      WITH n, SIZE(COLLECT(r)) as degree, COLLECT(r) as edges
      WHERE degree >= ${this.movieCnt} ${txtCondition}
      RETURN DISTINCT n, edges, degree 
      ORDER BY ${orderExpr} SKIP 0 LIMIT ${this.tableInput.pageSize}`;
    this._dbService.runQuery(cql, cb);
  }

  filterTable(filter: TableFiltering) {
    this.tableInput.currPage = 1;
    const skip = filter.skip ? filter.skip : 0;
    this.loadTable(skip, filter);
    if (this.tableInput.isLoadGraph) {
      this.loadGraph(skip, filter);
    }
  }

  private filterTableResponse(
    x: ActorCountData[],
    filter: TableFiltering
  ): ActorCountData[] {
    if (
      !filter ||
      ((!filter.txt || filter.txt.length < 1) &&
        filter.orderDirection == "" &&
        (!filter.skip || filter.skip == 0))
    ) {
      const skip = filter && filter.skip ? filter.skip : 0;
      this.tableInput.resultCnt = x.length;
      return x.slice(skip, skip + this._g.userPrefs.dataPageSize.getValue());
    }
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    let filtered: ActorCountData[] = [];

    for (let i = 0; i < x.length; i++) {
      const s = Object.values(x[i]).join("");
      if (
        (isIgnoreCase && s.toLowerCase().includes(filter.txt.toLowerCase())) ||
        (!isIgnoreCase && s.includes(filter.txt))
      ) {
        filtered.push(x[i]);
      }
    }

    // order by
    if (filter && filter.orderDirection.length > 0) {
      const o = filter.orderBy;
      if (filter.orderDirection == "asc") {
        filtered = filtered.sort((a, b) => {
          if (!a[o]) return 1;
          if (!b[o]) return -1;
          if (a[o] > b[o]) return 1;
          if (b[o] > a[o]) return -1;
          return 0;
        });
      } else {
        filtered = filtered.sort((a, b) => {
          if (!a[o]) return 1;
          if (!b[o]) return -1;
          if (a[o] < b[o]) return 1;
          if (b[o] < a[o]) return -1;
          return 0;
        });
      }
    }
    const skip = filter && filter.skip ? filter.skip : 0;
    if (filter) {
      this.tableInput.resultCnt = filtered.length;
    }
    return filtered.slice(
      skip,
      skip + this._g.userPrefs.dataPageSize.getValue()
    );
  }

  // tableInput is already filtered. Use that to filter graph elements.
  // For this query, we should specifically bring the related nodes and their 1-neighborhood
  private filterGraphResponse(x: GraphResponse): GraphResponse {
    const r: GraphResponse = { nodes: [], edges: x.edges };
    const nodeIdDict = {};
    for (let i = 0; i < this.tableInput.results.length; i++) {
      nodeIdDict[this.tableInput.results[i][0].val] = true;
    }
    // add a node if an edge starts with that
    for (let i = 0; i < x.edges.length; i++) {
      if (nodeIdDict[x.edges[i].startNodeElementId]) {
        nodeIdDict[x.edges[i].endNodeElementId] = true;
      }
    }

    for (let i = 0; i < x.nodes.length; i++) {
      if (nodeIdDict[x.nodes[i].elementId]) {
        r.nodes.push(x.nodes[i]);
      }
    }
    return r;
  }

  // zip paralel arrays
  private preprocessTableData(data): ActorCountData[] {
    const dbColumns = data.columns as string[];
    const uiColumns = ["id"].concat(this.tableInput.columns);
    let columnMapping = [];
    for (let i = 0; i < uiColumns.length; i++) {
      columnMapping.push(dbColumns.indexOf(uiColumns[i]));
    }
    const rawData = data.data[0];
    const objArr: ActorCountData[] = [];
    for (let i = 0; i < rawData[0].length; i++) {
      const obj = {};
      for (let j = 0; j < columnMapping.length; j++) {
        obj[uiColumns[j]] = rawData[columnMapping[j]][i];
      }
      objArr.push(obj as ActorCountData);
    }
    return objArr;
  }

  private getDateRangeCQL() {
    const isLimit = this._g.userPrefs.isLimitDbQueries2range.getValue();
    if (!isLimit) {
      return "TRUE";
    }
    const d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    const d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    return `r.act_begin >= ${d1} AND r.act_end <= ${d2}`;
  }
}
