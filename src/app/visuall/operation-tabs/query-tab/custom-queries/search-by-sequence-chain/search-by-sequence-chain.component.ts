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
  selector: "search-by-sequence-chain",
  templateUrl: "./search-by-sequence-chain.component.html",
  styleUrls: ["./search-by-sequence-chain.component.css"],
})
export class SequenceChainSearchComponent implements OnInit {
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
    isMergeGraph: false,
    isNodeData: true,
    isHide0: false,
  };
  graphResponse = null;
  clearTableFilter = new Subject<boolean>();

  sequences: string = "";
  maxJumpLength: number = 0;
  minSubsequenceMatchLength: number = 0;

  constructor(
    private _dbService: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this._g.userPreferences.dataPageSize.subscribe((x) => {
      this.tableInput.pageSize = x;
    });
  }

  prepareQuery() {
    this.tableInput.currentPage = 1;
    this.clearTableFilter.next(true);

    this.loadTable();
  }

  loadTable() {
    const sequences = this.prepareSequences(this.sequences);

    const callback = (x: any) => {
      // Advanced query response processing
      x.columns = ["node"];
      if (!this.tableInput.isLoadGraph) {
        x.data = x.data[0][0];
      } else {
        x["data"] = [];
        for (let i = 0; i < x.nodes.length; i++) {
          x["data"].push(x.nodes[i].properties);
        }
      }

      fillTable(x, this.tableInput, this.tableIsFilled);

      if (this.tableInput.isLoadGraph) {
        this._cyService.loadElementsFromDatabase(
          x,
          this.tableInput.isMergeGraph
        );

        if (this.graphResponse == null) {
          this.graphResponse = x;
        }
      }
    };

    this._dbService.sequenceChainSearch(
      sequences,
      this.maxJumpLength,
      this.minSubsequenceMatchLength,
      this.tableInput.isLoadGraph ? DbResponseType.graph : DbResponseType.table,
      callback
    );
  }

  // Transform the segment names into a format that can be used in the query
  private prepareSequences(sequences: string): string {
    return prepareInput(sequences).toUpperCase();
  }

  filterTable(filter: TableFiltering) {
    this.loadTable();

    filterTableData(
      filter,
      this.tableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
  }

  onMaxJumpLengthChange(event: any) {
    let min = 0,
      max = 20;
    if (!event.target.value || event.target.value <= min) {
      this.maxJumpLength = min;
    } else if (event.target.value >= max) {
      this.maxJumpLength = max;
    } else {
      this.maxJumpLength = Number(event.target.value);
    }
  }
  onMinSubsequenceMatchLengthChange(event: any) {
    let min = 0;
    if (!event.target.value || event.target.value <= min) {
      this.minSubsequenceMatchLength = min;
    } else {
      this.minSubsequenceMatchLength = Number(event.target.value);
    }
  }
}
