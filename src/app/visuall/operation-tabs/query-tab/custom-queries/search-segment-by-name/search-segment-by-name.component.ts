import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { DbResponseType } from "src/app/visuall/db-service/data-types";
import {
  filterTableDatas,
  TableFiltering,
  TableViewInput,
} from "../../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../../cytoscape.service";
import { Neo4jDb } from "../../../../db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../../global-variable.service";
import { fillTable, prepareInput } from "../custom-queries-helper";

@Component({
  selector: "search-segment-by-name",
  templateUrl: "./search-segment-by-name.component.html",
  styleUrls: ["./search-segment-by-name.component.css"],
})
export class SearchSegmentByNameComponent implements OnInit {
  tableIsFilled = new Subject<boolean>();
  clearTableFilter = new Subject<boolean>();
  graphResponse = null;
  tableInput: TableViewInput = {
    columns: [],
    results: [],
    tableTitle: "Query Results",
    isEmphasizeOnHover: true,
    isShowExportAsCSV: true,
    resultCount: 0,
    currentPage: 1,
    pageSize: 15,
    isLoadGraph: false,
    isMergeGraph: true,
    isNodeData: true,
    isHide0: false,
  };

  segmentNames: string;
  neighborDistance: number;

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
    this.neighborDistance = 1;
  }

  prepareQuery() {
    this.tableInput.currentPage = 1;
    this.clearTableFilter.next(true);

    this.loadTable();
    this.loadGraph();
  }

  loadTable() {
    const callback = (x: any) => {
      fillTable(x, this.tableInput, this.tableIsFilled);
    };

    let segmentNames = this.prepareSegmentNames(this.segmentNames);

    const cypherQuery = `WITH ['${segmentNames}'] as segmentNames
    MATCH (segment:SEGMENT)
    WHERE (segment.segmentName) IN segmentNames
    OPTIONAL MATCH path = (segment)-[*..${this.neighborDistance}]-(neighbor)
    UNWIND nodes(path) AS node
    WITH DISTINCT node
    RETURN node`;
    this._dbService.runQuery(cypherQuery, callback, DbResponseType.table);
  }

  loadGraph() {
    if (!this.tableInput.isLoadGraph) {
      return;
    }

    const callback = (x: any) => {
      this._cyService.loadElementsFromDatabase(x, this.tableInput.isMergeGraph);

      if (this.graphResponse == null) {
        this.graphResponse = x;
      }
    };

    let dataCount =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.dataPageSize.getValue();

    let segmentNames = this.prepareSegmentNames(this.segmentNames);

    const cypherQuery = `WITH ['${segmentNames}'] as segmentNames
      MATCH (segment:SEGMENT)
      WHERE (segment.segmentName) IN segmentNames
      OPTIONAL MATCH path = (segment)-[*..${this.neighborDistance}]-(neighbor)
      RETURN DISTINCT path`;
    `LIMIT ${dataCount}`;
    this._dbService.runQuery(cypherQuery, callback);
  }

  // Transform the segment names into a format that can be used in the query
  private prepareSegmentNames(segmentNames: string): string {
    return prepareInput(segmentNames);
  }

  filterTable(filter: TableFiltering) {
    this.loadTable();
    if (this.tableInput.isLoadGraph) {
      this.loadGraph();
    }

    filterTableDatas(
      filter,
      this.tableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
  }
}
