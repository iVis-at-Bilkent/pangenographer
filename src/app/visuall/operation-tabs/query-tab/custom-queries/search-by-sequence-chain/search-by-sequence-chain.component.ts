import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import {
  DbResponseType,
  GraphResponse,
} from "src/app/visuall/db-service/data-types";
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
  selector: "search-by-sequence-chain",
  templateUrl: "./search-by-sequence-chain.component.html",
  styleUrls: ["./search-by-sequence-chain.component.css"],
})
export class SearchBySequenceChainComponent implements OnInit {
  tableIsFilled = new Subject<boolean>();
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
  graphResponse = null;
  clearTableFilter = new Subject<boolean>();

  sequences: string;
  maxJumpLength: number;

  constructor(
    private _dbService: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this._g.userPreferences.dataPageSize.subscribe((x) => {
      this.tableInput.pageSize = x;
    });

    this.sequences = "";
    this.maxJumpLength = 1;
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

    const sequences = this.prepareSequences(this.sequences);

    const cypherQuery = ``;
    this._dbService.runQuery(cypherQuery, callback, DbResponseType.table);
  }

  loadGraph() {
    if (!this.tableInput.isLoadGraph) {
      return;
    }

    const callback = (x: any) => {
      this._cyService.loadElementsFromDatabase(
        this.filterGraphResponse(x),
        this.tableInput.isMergeGraph
      );

      if (this.graphResponse == null) {
        this.graphResponse = x;
      }
    };

    let dataCount =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.dataPageSize.getValue();

    const sequences = this.prepareSequences(this.sequences);

    let cypherQuery = ``;

    this._dbService.runQuery(cypherQuery, callback);
  }

  // Transform the segment names into a format that can be used in the query
  private prepareSequences(sequences: string): string {
    return prepareInput(sequences).toUpperCase();
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

  // tableInput is already filtered. Use that to filter graph elements.
  // For this query, we should specifically bring the related nodes and their 1-neighborhood
  private filterGraphResponse(graphResponse: GraphResponse): GraphResponse {
    const filteredResponse: GraphResponse = {
      nodes: [],
      edges: graphResponse.edges,
    };

    const nodeIdDictionary = {};
    for (let i = 0; i < this.tableInput.results.length; i++) {
      nodeIdDictionary[this.tableInput.results[i][0].value] = true;
    }

    // Add a node if an edge starts with a node that is already in the dictionary
    for (let i = 0; i < graphResponse.edges.length; i++) {
      if (nodeIdDictionary[graphResponse.edges[i].startNodeElementId]) {
        nodeIdDictionary[graphResponse.edges[i].endNodeElementId] = true;
      }
    }

    for (let i = 0; i < graphResponse.nodes.length; i++) {
      if (nodeIdDictionary[graphResponse.nodes[i].elementId]) {
        filteredResponse.nodes.push(graphResponse.nodes[i]);
      }
    }

    return filteredResponse;
  }

  onMaxJumpLengthChange(event: any) {
    if (!event.target.value || event.target.value <= 1) {
      this.maxJumpLength = 1;
    } else if (event.target.value >= 20) {
      this.maxJumpLength = 20;
    } else {
      this.maxJumpLength = Number(event.target.value);
    }
  }
}
