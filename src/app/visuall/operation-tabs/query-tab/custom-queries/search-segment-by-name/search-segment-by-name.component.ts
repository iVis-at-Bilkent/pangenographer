import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import {
  DbResponseType,
  GFASegment,
  GraphResponse,
  TableResponse,
} from "src/app/visuall/db-service/data-types";
import {
  TableData,
  TableDataType,
  TableFiltering,
  TableViewInput,
} from "../../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../../cytoscape.service";
import { Neo4jDb } from "../../../../db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../../global-variable.service";

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
    MATCH (segment:SEGMENT)
    WHERE (segment.segmentName) IN segmentNames
    OPTIONAL MATCH path = (segment)-[*..1]-(neighbor)
    UNWIND nodes(path) AS node
    RETURN DISTINCT node`;
    this._dbService.runQuery(cql, cb, DbResponseType.table);
  }

  loadGraph(skip: number, filter?: TableFiltering) {
    if (!this.tableInput.isLoadGraph) {
      return;
    }

    const cb = (x: any) => {
      this._cyService.loadElementsFromDatabase(
        this.filterGraphResponse(x),
        this.tableInput.isMergeGraph
      );

      if (!filter || this.graphResponse == null) {
        this.graphResponse = x;
      }
    };

    let dataCnt =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.dataPageSize.getValue();

    let segmentNames = this.segmentNames.split("\n").join("','");
    segmentNames = "'" + segmentNames + "'";

    const cql = `WITH [${segmentNames}] as segmentNames
      MATCH (segment:SEGMENT)
      WHERE (segment.segmentName) IN segmentNames
      OPTIONAL MATCH path = (segment)-[*..1]-(neighbor)
      RETURN DISTINCT segment, nodes(path), relationships(path)
      SKIP ${skip} LIMIT ${dataCnt}`;
    this._dbService.runQuery(cql, cb);
  }

  // This function is called when the table is filled with data
  fillTable(tableResponse: TableResponse) {
    console.log(tableResponse);
    console.log(this.tableInput.columns);
    console.log(this.tableInput.results);

    this.tableInput.results = [];
    let segmentNameMap: { [key: string]: boolean } = {}; // To keep track of unique segment names
    let segmentNameMapSize = 0; // To keep track of unique segment names
    for (let i = 0; i < tableResponse.data.length; i++) {
      const segment = tableResponse.data[i] as unknown as GFASegment;

      // Check if the segment name is already in the map
      if (segment.segmentName in segmentNameMap) {
        continue;
      }

      // If not, add it to the map
      segmentNameMap[segment.segmentName] = true;
      segmentNameMapSize++;

      // Create a row for the table
      const row: TableData[] = [];

      // ID of the row is the index of the segment name in the map (0-indexed)
      // This is just for the table. The actual ID is the segment name itself
      row.push({
        value: segment.elementId,
        type: TableDataType.string,
      });
      row.push({
        value: segment.segmentName,
        type: TableDataType.string,
      });
      row.push({
        value: segment.segmentLength,
        type: TableDataType.number,
      });
      row.push({
        value: segment.segmentData,
        type: TableDataType.data,
      });

      this.tableInput.results.push(row); // Add the row to the table
    }

    console.log(this.tableInput.results);

    this.tableInput.resultCount = this.tableInput.results.length; // Set the result count
    this.tableFilled.next(true); // Notify that the table is filled
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
  private filterGraphResponse(graphResponse: GraphResponse): GraphResponse {
    console.log(graphResponse);
    console.log(this.tableInput.results);

    const filteredResponse: GraphResponse = {
      nodes: [],
      edges: graphResponse.edges,
    };

    const nodeIdDictionary = {};
    for (let i = 0; i < this.tableInput.results.length; i++) {
      nodeIdDictionary[this.tableInput.results[i][0].value] = true;
    }

    console.log(nodeIdDictionary);

    // Add a node if an edge starts with a node that is already in the dictionary
    for (let i = 0; i < graphResponse.edges.length; i++) {
      if (nodeIdDictionary[graphResponse.edges[i].startNodeElementId]) {
        nodeIdDictionary[graphResponse.edges[i].endNodeElementId] = true;
      }
    }

    console.log(nodeIdDictionary);
    for (let i = 0; i < graphResponse.nodes.length; i++) {
      if (nodeIdDictionary[graphResponse.nodes[i].elementId]) {
        filteredResponse.nodes.push(graphResponse.nodes[i]);
      }
    }
    console.log(filteredResponse);

    return filteredResponse;
  }
}
