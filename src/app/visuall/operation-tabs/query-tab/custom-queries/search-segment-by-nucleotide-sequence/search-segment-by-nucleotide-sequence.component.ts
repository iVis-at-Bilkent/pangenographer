import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { DbResponseType } from "src/app/visuall/db-service/data-types";
import {
  filterTableData,
  TableFiltering,
  TableViewInput,
} from "../../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../../cytoscape.service";
import { Neo4jDb } from "../../../../db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../../global-variable.service";
import { fillTable, prepareInput } from "../custom-queries-helper";

@Component({
  selector: "search-segment-by-nucleotide-sequence",
  templateUrl: "./search-segment-by-nucleotide-sequence.component.html",
  styleUrls: ["./search-segment-by-nucleotide-sequence.component.css"],
})
export class SearchSegmentByNucleotideSequenceComponent implements OnInit {
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
  graphEdges: boolean = true;

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

    const cypherQuery = `WITH [${sequences}] as sequences
      MATCH (segment:SEGMENT)
      WHERE any(sequence IN sequences WHERE segment.segmentData CONTAINS sequence)
      WITH DISTINCT segment
      RETURN segment`;
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

    const sequences = this.prepareSequences(this.sequences);

    let cypherQuery = `WITH [${sequences}] as sequences
      MATCH (segment:SEGMENT)
      WHERE any(sequence IN sequences WHERE segment.segmentData CONTAINS sequence)\n`;
    if (this.graphEdges) {
      cypherQuery += `OPTIONAL MATCH (segment)-[r]-(relatedSegment:SEGMENT)
      WHERE any(sequence IN sequences WHERE relatedSegment.segmentData CONTAINS sequence)\n`;
    }
    cypherQuery += `RETURN DISTINCT segment`;
    if (this.graphEdges) {
      cypherQuery += `, r, relatedSegment`;
    }
    cypherQuery += `\nLIMIT ${dataCount}`;

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

    filterTableData(
      filter,
      this.tableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
  }
}
