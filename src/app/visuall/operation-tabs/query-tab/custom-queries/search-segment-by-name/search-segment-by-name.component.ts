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
} from "../../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../../cytoscape.service";
import { Neo4jDb } from "../../../../db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../../global-variable.service";
import { buildIdFilter } from "../query-helper";

export interface SegmentData {
  id: number;
  segmentName: string;
  segmentLength: number;
  segmentData: string;
}

interface TableFillData {
  columns: string[];
  data: any[]; // Arrays of length 2 segments
}

@Component({
  selector: "search-segment-by-name",
  templateUrl: "./search-segment-by-name.component.html",
  styleUrls: ["./search-segment-by-name.component.css"],
})
export class SearchSegmentByNameComponent implements OnInit {
  tableFilled = new Subject<boolean>();
  tableInput: TableViewInput = {
    columns: ["Segment Name", "Segment Length", "Segment Data"],
    results: [],
    tableTitle: "Query Results",
    isEmphasizeOnHover: true,
    classNameOfObjects: "Segment", // Check if this is correct
    isShowExportAsCSV: true,
    resultCount: 0,
    currentPage: 1,
    pageSize: 0,
    isLoadGraph: false,
    isMergeGraph: true,
    isNodeData: true,
  };
  tableResponse = null;
  graphResponse = null;
  clearTableFilter = new Subject<boolean>();

  segmentNames: string;

  constructor(
    private _dbService: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this._g.userPreferences.dataPageSize.subscribe((x) => {
      this.tableInput.pageSize = x;
    });

    this.segmentNames = "";
  }

  prepareQuery() {
    this.tableInput.currentPage = 1;
    this.clearTableFilter.next(true);
    const skip = (this.tableInput.currentPage - 1) * this.tableInput.pageSize;
    this.loadTable(skip);
    this.loadGraph(skip);
  }

  loadTable(skip: number, filter?: TableFiltering) {
    const cb = (x: any) => {
      console.log(x);

      this.fillTable(x);

      console.log(x);

      if (!filter) {
        this.tableResponse = x;
      }
    };

    let dataCnt = this.tableInput.pageSize;
    dataCnt =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.dataPageSize.getValue();

    const r = `[${skip}..${skip + dataCnt}]`;

    let segmentNames = this.segmentNames.split("\n").join("','");
    segmentNames = "'" + segmentNames + "'";

    const cql = `WITH [${segmentNames}] as segmentNames
    MATCH (s:SEGMENT)
    WHERE (s.segmentName) IN segmentNames
    OPTIONAL MATCH path = (s)-[*..1]-(neighbor)
    WITH s, nodes(path) AS pathNodes
    UNWIND pathNodes AS node
    RETURN DISTINCT s, node`;
    this._dbService.runQuery(cql, cb, DbResponseType.table);
  }

  loadGraph(skip: number, filter?: TableFiltering) {
    if (!this.tableInput.isLoadGraph) {
      return;
    }

    const isClientSidePagination =
      this._g.userPreferences.queryResultPagination.getValue() == "Client";

    const cb = (x: any) => {
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
    let dataCnt = this.tableInput.pageSize;

    if (isClientSidePagination) {
      dataCnt =
        this._g.userPreferences.dataPageLimit.getValue() *
        this._g.userPreferences.dataPageSize.getValue();
    }

    let segmentNames = this.segmentNames.split("\n").join("','");
    segmentNames = "'" + segmentNames + "'";

    const cql = `WITH [${segmentNames}] as segmentNames
      MATCH (s:SEGMENT)
      WHERE (s.segmentName) IN segmentNames
      OPTIONAL MATCH path = (s)-[*..1]-(neighbor)
      RETURN DISTINCT s, nodes(path), relationships(path)
      SKIP ${skip} LIMIT ${dataCnt}`;
    this._dbService.runQuery(cql, cb);
  }

  // This function is called when the table is filled with data
  fillTable(tableFillData: TableFillData) {
    console.log(tableFillData);
    console.log(this.tableInput.columns);
    console.log(this.tableInput.results);

    this.tableInput.results = [];
    let segmentNameMap = {}; // To keep track of unique segment names
    let segmentNameMapSize = 0; // To keep track of unique segment names
    for (let i = 0; i < tableFillData.data.length; i++) {
      for (let j = 0; j < 2; j++) {
        // Check if the segment name is already in the map
        if (tableFillData.data[i][j].segmentName in segmentNameMap) {
          continue;
        }

        // If not, add it to the map
        segmentNameMap[tableFillData.data[i][j].segmentName] = true;
        segmentNameMapSize++;

        // Create a row for the table
        const row: TableData[] = [];

        // ID of the row is the index of the segment name in the map (0-indexed)
        // This is just for the table. The actual ID is the segment name itself
        row.push({
          value: segmentNameMapSize - 1,
          type: TableDataType.number,
        });
        row.push({
          value: tableFillData.data[i][j].segmentName,
          type: TableDataType.string,
        });
        row.push({
          value: tableFillData.data[i][j].segmentLength,
          type: TableDataType.number,
        });
        row.push({
          value: tableFillData.data[i][j].segmentData,
          type: TableDataType.data,
        });

        this.tableInput.results.push(row); // Add the row to the table
      }
    }

    console.log(this.tableInput.results);

    this.tableInput.resultCount = this.tableInput.results.length; // Set the result count
    this.tableFilled.next(true); // Notify that the table is filled
  }

  getDataForQueryResult(e: TableRowMeta) {
    let s = `Search Segment Names: "", "", ""`;
    if (e.tableIndex) {
      s += ", " + e.tableIndex.join(",");
    }
    const cb = (x: any) => {
      this._cyService.loadElementsFromDatabase(x, this.tableInput.isMergeGraph);
      this._g.add2GraphHistory(s);
    };

    const idFilter = buildIdFilter(e.dbIds);

    let segmentNames = this.segmentNames.split("\n").join("','");
    segmentNames = "'" + segmentNames + "'";

    let cql = `WITH [${segmentNames}] as segmentNames
      MATCH (s:SEGMENT)
      WHERE (s.segmentName) IN segmentNames ${idFilter}
      OPTIONAL MATCH path = (s)-[*..1]-(neighbor)
      RETURN DISTINCT s, nodes(path), relationships(path)
      SKIP 0 LIMIT ${this.tableInput.pageSize}`;
    this._dbService.runQuery(cql, cb);
  }

  filterTable(filter: TableFiltering) {
    this.tableInput.currentPage = 1;
    const skip = filter.skip ? filter.skip : 0;
    this.loadTable(skip, filter);
    if (this.tableInput.isLoadGraph) {
      this.loadGraph(skip, filter);
    }
  }

  // tableInput is already filtered. Use that to filter graph elements.
  // For this query, we should specifically bring the related nodes and their 1-neighborhood
  private filterGraphResponse(x: GraphResponse): GraphResponse {
    console.log(x);
    const r: GraphResponse = { nodes: [], edges: x.edges };
    const nodeIdDict = {};
    for (let i = 0; i < this.tableInput.results.length; i++) {
      nodeIdDict[this.tableInput.results[i][0].value] = true;
    }
    console.log(nodeIdDict);
    // add a node if an edge starts with that
    for (let i = 0; i < x.edges.length; i++) {
      if (nodeIdDict[x.edges[i].startNodeElementId]) {
        nodeIdDict[x.edges[i].endNodeElementId] = true;
      }
    }
    console.log(nodeIdDict);
    for (let i = 0; i < x.nodes.length; i++) {
      if (nodeIdDict[x.nodes[i].elementId]) {
        r.nodes.push(x.nodes[i]);
      }
    }
    console.log(r);
    return r;
  }
}
