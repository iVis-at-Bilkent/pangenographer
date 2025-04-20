import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import {
  object2TableRow,
  TableData,
  translateColumnNamesAndProperties,
} from "src/app/shared/table-view/table-view-types";
import {
  deepCopy,
  GFA_SEGMENT_PROPERTIES_NOT_TO_SHOW,
} from "src/app/visuall/constants";
import {
  GFASegment,
  GraphResponse,
} from "src/app/visuall/db-service/data-types";
import {
  TableFiltering,
  TableViewInput,
} from "../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../cytoscape.service";
import { DbResponse } from "../../../db-service/data-types";
import { Neo4jDb } from "../../../db-service/neo4j-db.service";
import { GlobalVariableService } from "../../../global-variable.service";

@Component({
  selector: "app-custom-queries",
  templateUrl: "./custom-queries.component.html",
  styleUrls: ["./custom-queries.component.css"],
})
export class CustomQueriesComponent implements OnInit {
  tableIsFilled = new Subject<boolean>();
  tableInput: TableViewInput = {
    columns: [],
    results: [],
    tableTitle: "Query Results",
    isEmphasizeOnHover: true,
    isShowExportAsCSV: true,
    resultCount: 0,
    currentPage: 1,
    pageSize: this._g.userPreferences.queryResultPageSize.getValue(),
    isLoadGraph: false,
    isMergeGraph: false,
    isNodeData: true,
    isHide0: false,
    queriedSequences: undefined,
  };
  clearTableFilter = new Subject<boolean>();

  sequences: string = "";
  segmentNames: string = "";
  neighborDistance: number = 0;
  maxJumpLength: number = 0;
  minSubsequenceMatchLength: number = 2;
  graphEdges: boolean = true;

  queries: string[] = [
    "Search segment by name",
    "Search segment by sequence",
    "Search by sequence chain",
  ];
  selectedQuery: string = "";
  databaseResponse: DbResponse = {} as DbResponse;

  constructor(
    private _dbService: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this._g.userPreferences.queryResultPageSize.subscribe((pageSize) => {
      this.tableInput.pageSize = pageSize;
    });
  }

  execute() {
    this.tableInput.currentPage = 1;
    this.clearTableFilter.next(true);

    const callback = (response: any) => {
      this.databaseResponse.graphData = response;
      this.filterTable({
        orderBy: null,
        orderDirection: null,
        txt: "",
        skip: null,
      } as TableFiltering);

      if (this.tableInput.isLoadGraph) {
        this._cyService.loadElementsFromDatabase(
          response,
          this.tableInput.isMergeGraph
        );
      }
    };

    let dataCount =
      this._g.userPreferences.dataPageLimit.getValue() *
      this._g.userPreferences.queryResultPageSize.getValue();

    const sequences = this.prepareInput(this.sequences, true); // To uppercase

    if (this.selectedQuery === this.queries[2]) {
      // Search by sequence chain
      this.tableInput.queriedSequences =
        sequences.replace(/'/g, "") +
        "," +
        this.maxJumpLength +
        "," +
        this.minSubsequenceMatchLength;
      this._dbService.sequenceChainSearch(
        sequences,
        this.maxJumpLength,
        this.minSubsequenceMatchLength,
        callback
      );
    } else if (this.selectedQuery === this.queries[1]) {
      // Search by sequence
      this.tableInput.queriedSequences = sequences.replace(/'/g, "");
      const cypherQuery =
        `
      WITH [${sequences}] as sequences
      MATCH (segment:SEGMENT)
      WHERE any(sequence IN sequences WHERE segment.segmentData CONTAINS sequence)
      ` +
        (this.graphEdges
          ? `
        OPTIONAL MATCH (segment)-[r]-(relatedSegment:SEGMENT)
        WHERE any(sequence IN sequences WHERE relatedSegment.segmentData CONTAINS sequence)
        `
          : "") +
        `RETURN DISTINCT segment` +
        (this.graphEdges ? `, r, relatedSegment` : "") +
        ` LIMIT ${dataCount}`;

      this._dbService.runQuery(cypherQuery, callback);
    } else if (this.selectedQuery === this.queries[0]) {
      // Search by name
      const segmentNames = this.prepareInput(this.segmentNames);
      const cypherQuery =
        `
        WITH [${segmentNames}] as segmentNames
        MATCH (segment:SEGMENT)
        WHERE (segment.segmentName) IN segmentNames
        ` +
        (this.neighborDistance
          ? `OPTIONAL MATCH path = (segment)-[*..${this.neighborDistance}]-(neighbor)
          RETURN DISTINCT path
          `
          : `RETURN segment`) +
        ` LIMIT ${dataCount}`;
      this._dbService.runQuery(cypherQuery, callback);
    }
  }

  filterTable(filter: TableFiltering) {
    const filteredResponse = this.filterDatabaseResponse(
      deepCopy(this.databaseResponse),
      filter
    );

    this.fillTable(filteredResponse.graphData);

    if (this.tableInput.isLoadGraph) {
      this._cyService.loadElementsFromDatabase(
        filteredResponse.graphData as GraphResponse,
        this.tableInput.isMergeGraph && this._g.cy.elements().length > 0
      );
    }

    this.tableInput.resultCount = filteredResponse.count;
  }

  // used for client-side filtering, assumes graphData arrays are parallel (index i corresponds to the same element)
  private filterDatabaseResponse(
    databaseResponse: DbResponse,
    filter: TableFiltering
  ): DbResponse {
    const response: DbResponse = {
      count:
        this._g.userPreferences.queryResultPageSize.getValue() *
        this._g.userPreferences.dataPageLimit.getValue(),
      graphData: databaseResponse.graphData,
      tableData: { columns: [], data: [] },
    };

    let tempData: { graph: any; table: any }[] = [];

    for (let i = 0; i < databaseResponse.graphData.nodes.length; i++) {
      const values = Object.values(databaseResponse.graphData.nodes[i]).join(
        ""
      );

      if (
        (this._g.userPreferences.isIgnoreCaseInText.getValue() &&
          values.toLowerCase().includes(filter.txt.toLowerCase())) ||
        (!this._g.userPreferences.isIgnoreCaseInText.getValue() &&
          values.includes(filter.txt))
      ) {
        // just nodes
        tempData.push({
          table: undefined,
          graph: databaseResponse.graphData.nodes[i],
        });
      }
    }
    // order by
    if (filter.orderDirection && filter.orderDirection.length > 0) {
      const o = filter.orderBy;
      if (filter.orderDirection == "asc") {
        tempData = tempData.sort((a, b) => {
          if (a.table[1][o] > b.table[1][o]) {
            return 1;
          } else if (b.table[1][o] > a.table[1][o]) {
            return -1;
          } else {
            return 0;
          }
        });
      } else {
        tempData = tempData.sort((a, b) => {
          if (a.table[1][o] < b.table[1][o]) {
            return 1;
          } else if (b.table[1][o] < a.table[1][o]) {
            return -1;
          } else {
            return 0;
          }
        });
      }
    }
    // pagination
    const skip = filter.skip ? filter.skip : 0;
    response.count = tempData.length;
    tempData = tempData.slice(
      skip,
      skip + this._g.userPreferences.queryResultPageSize.getValue()
    );

    // just nodes
    response.graphData.nodes = tempData.map((x) => x.graph);

    return response;
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

  onNeighborDistanceChange(event: any) {
    if (!event.target.value || event.target.value <= 0) {
      this.neighborDistance = 0;
    } else if (event.target.value >= 20) {
      this.neighborDistance = 20;
    } else {
      this.neighborDistance = Number(event.target.value);
    }
  }

  private fillTable(graphResponse: GraphResponse) {
    this.tableIsFilled.next(false);
    this.tableInput.results = [];
    this.tableInput.columns = [];
    let segmentNameMap: { [key: string]: boolean } = {}; // To keep track of unique segment names
    let segmentNameMapSize = 0; // To keep track of unique segment names

    // Iterate over the data to set up the column names
    for (let i = 0; i < graphResponse.nodes.length; i++) {
      const segment: GFASegment = this.graphResponseNodeToSegment(
        graphResponse.nodes[i]
      );
      const keys: string[] = Object.keys(segment);
      for (let j = 0; j < keys.length; j++) {
        if (this.tableInput.columns.indexOf(keys[j]) === -1) {
          this.tableInput.columns.push(keys[j]);
        }
      }
    }

    // Remove properties that are not to be shown
    this.tableInput.columns = this.tableInput.columns.filter(
      (x) => !GFA_SEGMENT_PROPERTIES_NOT_TO_SHOW.includes(x)
    );

    this.tableInput.columns.sort(); // Sort the column names

    // Move the segment data to the third column
    this.tableInput.columns = this.tableInput.columns.filter(
      (x) => x !== "segmentData"
    );
    this.tableInput.columns.unshift("segmentData");
    // Move the segment length to the second column
    this.tableInput.columns = this.tableInput.columns.filter(
      (x) => x !== "segmentLength"
    );
    this.tableInput.columns.unshift("segmentLength");
    // Move the segment name to the first column
    this.tableInput.columns = this.tableInput.columns.filter(
      (x) => x !== "segmentName"
    );
    this.tableInput.columns.unshift("segmentName");

    // Translate the column names to a more readable format
    this.tableInput.columns = translateColumnNamesAndProperties(
      this.tableInput.columns
    );

    // Iterate over the data to fill the table
    for (let i = 0; i < graphResponse.nodes.length; i++) {
      const segment: GFASegment = this.graphResponseNodeToSegment(
        graphResponse.nodes[i]
      );

      // Check if the segment name is already in the map
      if (segment.segmentName in segmentNameMap) {
        continue;
      }

      // If not, add it to the map
      segmentNameMap[segment.segmentName] = true;
      segmentNameMapSize++;

      // Create a row for the table
      const row: TableData[] = object2TableRow(
        segment,
        this.tableInput.columns,
        segment.elementId
      );

      this.tableInput.results.push(row); // Add the row to the table
    }

    this.tableInput.resultCount = this.tableInput.results.length; // Set the result count
    this.tableIsFilled.next(true); // Notify that the table is filled
  }

  // Common function to prepare the input for queries
  private prepareInput(input: string, toUpperCase: boolean = false): string {
    // Remove spaces, split by newlines and commas, filter out empty strings,
    // join with "','", and wrap the result in single quotes.
    let result =
      "'" +
      input
        .replace(/ /g, "")
        .split(/[\n,]/)
        .filter((x) => x)
        .join("','") +
      "'";

    if (toUpperCase) {
      result = result.toUpperCase();
    }

    return result;
  }

  // TODO: Move this function to cy service or db service
  private graphResponseNodeToSegment(node: any): GFASegment {
    return {
      elementId: node.elementId,
      id: node.id,
      segmentName: node.properties.segmentName,
      segmentLength: node.properties.segmentLength,
      segmentData: node.properties.segmentData,
      kmerCount: node.properties.kmerCount,
      readCount: node.properties.readCount,
      fragmentCount: node.properties.fragmentCount,
      stableSequenceName: node.properties.stableSequenceName,
      stableSequenceOffset: node.properties.stableSequenceOffset,
      stableSequenceRank: node.properties.stableSequenceRank,
      Sha256Checksum: node.properties.Sha256Checksum,
      UriOrLocalSystemPath: node.properties.UriOrLocalSystemPath,
      walkSampleIdentifiers: node.properties.walkSampleIdentifiers,
      pathNames: node.properties.pathNames,
    };
  }
}
