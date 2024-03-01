import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "src/environments/environment";
import {
  TableData,
  TableDataType,
  TableViewInput,
} from "../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../cytoscape.service";
import { GlobalVariableService } from "../../../global-variable.service";
@Component({
  selector: "app-blast-tab",
  templateUrl: "./blast-tab.component.html",
  styleUrls: ["./blast-tab.component.css"],
})
export class BlastTabComponent implements OnInit {
  query: string = "";
  types: string[] = ["Standalone", "Web"];
  selectedType: string = "Standalone";
  selectedTypeIdx: number = 0;

  webDatabase: string = "nr";
  webPrograms: string[] = ["blastn", "blastp", "blastx", "tblastn", "tblastx"];
  webSelectedProgram: string = "blastn";
  webEnableMegaBlast: boolean = false;
  webFilters: string[] = ["F", "T", "L", "mT", "mL"];
  webSelectedFilter: string = "F";
  webFormatTypes: string[] = [
    "Text",
    "HTML",
    "XML",
    "XML2",
    "JSON2",
    "Tabular",
  ];
  webSelectedFormatType: string = "HTML";
  webExpect: number = 0;
  webNulceotideReward: number = 0;
  webNucleotidePenalty: number = 0;
  webGapCost: string = "";
  webMatrixs: string[] = [
    "BLOSUM45",
    "BLOSUM50",
    "BLOSUM62",
    "BLOSUM80",
    "BLOSUM90",
    "PAM250",
    "PAM30",
    "PAM70",
  ];
  webSelectedMatrix: string = "BLOSUM62";
  webSelectedMatrixIdx: number = 2;
  webHitlistSize: number = 0;
  webDescriptions: number = 0;
  webAlignments: number = 0;
  webNcbiGenInfos: string[] = ["T", "F"];
  webSelectedNCBIGenInfo: string = "T";
  webRid: string = "";
  webRtoe: number = undefined;
  webStatus: string = "";
  webThreshold: number = 0;
  webWordSize: number = 0;
  webCompositionBasedStatistics: number[] = [-1, 0, 1, 2, 3];
  webSelectedCompositionBasedStatistic: number = -1;
  webSelectedCompositionBasedStatisticsIdx: number = 0;
  webFormatObjects: string[] = ["SearchInfo", "Alignments"];
  webSelectedFormatObject: string = "SearchInfo";
  webResult: string = "";
  webResultTableInput: string = "";

  standaloneTableOutput: TableViewInput = {
    results: [],
    columns: [
      "ID",
      "Query Name",
      "Source Name",
      "Percent Identity",
      "Alignment Length",
      "Mismatches",
      "Gap Opens",
      "Query Start",
      "Query End",
      "Source Start",
      "Source End",
      "E-value",
      "Bit Score",
    ],
    isLoadGraph: false,
    isMergeGraph: false,
    currPage: 1,
    pageSize: 20,
    resultCnt: 0,
    isNodeData: false,
    isShowExportAsCSV: false,
    isHide0: false,
    isUseCySelector4Highlight: false,
    isHideLoadGraph: false,
    isReplace_inHeaders: false,
    isDisableHover: false,
    tableTitle: "Blast Result",
    isEmphasizeOnHover: false,
  };

  standaloneQuery: string = "";
  standaloneStatus: string = "";
  standaloneUrl: string = environment.blastStandaloneUrl;
  standaloneCommandLineArguments: string = "-outfmt 6";
  standaloneIsTableOutput: boolean = false;
  standaloneIsTableOutputFilled = new Subject<boolean>();
  standaloneclearTableOutputFilter = new Subject<boolean>();
  standaloneDBStatus: string = "";

  constructor(
    protected _http: HttpClient,
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService
  ) {}

  ngOnInit(): void {}

  onchangeTypeChange(event: any) {
    this.selectedType = event.target.value;
    if (this.selectedType === "Standalone") {
      this.selectedTypeIdx = 0;
    } else if (this.selectedType === "Web") {
      this.selectedTypeIdx = 1;
    } else {
      this.selectedTypeIdx = -1;
    }
    this.query = "";
  }

  private runWebBlastQuery(queryParams: string, callback: (x: any) => any) {
    const url = "https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?";
    this._g.setLoadingStatus(true);
    const q = url + queryParams;
    console.log(q);
    this._g.statusMsg.next("Executing blast query...");

    let error = (x: any) => {
      this._g.setLoadingStatus(false);
      console.log(x["error"]["text"]);
      callback(x["error"]["text"]);
    };
    this._http.post(q, null).subscribe((x: any) => {
      this._g.setLoadingStatus(false);
      console.log(x["error"]["text"]);
    }, error);
  }

  executeWebBlastQueryWithParams() {
    let queryParams = "CMD=Put";
    if (this.query) {
      queryParams += "&QUERY=" + this.query;
    } else {
      this._g.showErrorModal(
        "No query sequence",
        "Please enter a query sequence and try again."
      );
      return;
    }
    if (this.webDatabase) {
      queryParams += "&DATABASE=" + this.webDatabase;
    } else {
      this._g.showErrorModal(
        "No database selected",
        "Please select a database and try again."
      );
      return;
    }
    if (this.webSelectedProgram) {
      queryParams += "&PROGRAM=" + this.webSelectedProgram;
    } else {
      this._g.showErrorModal(
        "No program selected",
        "Please select a program and try again."
      );
      return;
    }
    if (this.webEnableMegaBlast) {
      queryParams += "&MEGABLAST=on";
    }
    if (this.webSelectedFilter && this.webSelectedFilter != "F") {
      queryParams += "&FILTER=" + this.webSelectedFilter;
    }
    if (this.webSelectedFormatType) {
      queryParams += "&FORMAT_TYPE=" + this.webSelectedFormatType;
    }
    if (this.webExpect) {
      queryParams += "&EXPECT=" + this.webExpect;
    }
    if (this.webNulceotideReward) {
      queryParams += "&NUCL_REWARD=" + this.webNulceotideReward;
    }
    if (this.webNulceotideReward) {
      queryParams += "&NUCL_PENALTY=" + this.webNulceotideReward;
    }
    if (this.webGapCost) {
      queryParams += "&GAPCOSTS=" + this.webGapCost;
    }
    queryParams += "&MATRIX_NAME=" + this.webSelectedMatrix;
    if (this.webHitlistSize) {
      queryParams += "&HITLIST_SIZE=" + this.webHitlistSize;
    }
    if (this.webDescriptions) {
      queryParams += "&DESCRIPTIONS=" + this.webDescriptions;
    }
    if (this.webAlignments) {
      queryParams += "&ALIGNMENTS=" + this.webAlignments;
    }
    queryParams += "&NCBI_GI=" + this.webSelectedNCBIGenInfo;
    if (this.webThreshold) {
      queryParams += "&THRESHOLD=" + this.webThreshold;
    }
    if (this.webWordSize) {
      queryParams += "&WORD_SIZE=" + this.webWordSize;
    }
    if (this.webSelectedCompositionBasedStatistic != -1) {
      queryParams +=
        "&COMPOSITION_BASED_STATISTICS=" +
        this.webSelectedCompositionBasedStatistic;
    }
    console.log(queryParams.replace(/&/g, "\n"));
    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/^    RID = (.*)$/m);
      this.webRid = match && match[1];
      console.log(match);
      match = result.match(/^    RTOE = (.*)$/m);
      this.webRtoe = match && match[1];
      console.log(match);
      console.log(this.webRid);
      console.log(this.webRtoe);
      this._g.statusMsg.next("Blast query submitted successfully.");
    });
  }

  checkWebBlastQueryStatus() {
    let queryParams = "CMD=Get&RID=" + this.webRid;
    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/Status=(\w+)/);
      this.webStatus = match && match[1];
      console.log(result);
      console.log(match);
      console.log(this.webStatus);
      this._g.statusMsg.next("Blast query checked successfully.");
    });
  }

  getWebBlastQueryResult() {
    let queryParams = "CMD=Get&RID=" + this.webRid + "&VIEW_RESULTS=FromRes";
    queryParams += "&FORMAT_TYPE=" + this.webSelectedFormatType;
    this.runWebBlastQuery(queryParams, (result: any) => {
      this.webResult = result;
      console.log(result);
      this._g.statusMsg.next("Blast query result retrieved successfully.");
    });
  }

  fillQueryTextareaWithSelectedSegmentsSequence(isStandalone: boolean = false) {
    const selectedSegments = this._g.cy.$(":selected");
    if (selectedSegments.length == 0) {
      this._g.showErrorModal(
        "No segments selected",
        "Please select segments and try again."
      );
      return;
    }
    let selectedSegmentSeq =
      this._cyService.prepareAllNodesFastaData(selectedSegments);

    if (isStandalone) {
      this.standaloneQuery = selectedSegmentSeq;
      return;
    }
    this.query = selectedSegmentSeq;
  }

  onQueryChange(event: any) {
    this.query = event.target.value.trim();
  }

  onWebDatabaseChange(event: any) {
    this.webDatabase = event.target.value.trim();
  }

  onWebProgramChange(event: any) {
    this.webSelectedProgram = event.target.value.trim();
  }

  onWebMegaBlastChange(event: any) {
    this.webEnableMegaBlast = event.target.checked;
  }

  onWebFilterChange(event: any) {
    this.webSelectedFilter = event.target.value.trim();
  }

  onWebFormatTypeChange(event: any) {
    this.webSelectedFormatType = event.target.value.trim();
  }

  onWebExpectChange(event: any) {
    this.webExpect = event.target.value.trim();
  }

  onWebNucleotideRewardChange(event: any) {
    this.webNulceotideReward = event.target.value.trim();
  }

  onWebNucleotidePenaltyChange(event: any) {
    this.webNulceotideReward = event.target.value.trim();
  }

  onWebGapCostChange(event: any) {
    this.webGapCost = event.target.value.trim();
  }

  onWebMatrixChange(event: any) {
    this.webSelectedMatrixIdx = event.target.selectedIndex;
    this.webSelectedMatrix = this.webMatrixs[this.webSelectedMatrixIdx];
  }

  onWebHitlistSizeChange(event: any) {
    this.webHitlistSize = event.target.value.trim();
  }

  onWebDescriptionsChange(event: any) {
    this.webDescriptions = event.target.value.trim();
  }

  onWebAlignmentsChange(event: any) {
    this.webAlignments = event.target.value.trim();
  }

  onWebNCBIGenInfoChange(event: any) {
    this.webSelectedNCBIGenInfo = event.target.value.trim();
  }

  onWebRIDChange(event: any) {
    this.webRid = event.target.value.trim();
  }

  onWebThresholdChange(event: any) {
    this.webThreshold = event.target.value.trim();
  }

  onWebWordSizeChange(event: any) {
    this.webWordSize = event.target.value.trim();
  }

  onWebCompositionBasedStatisticsChange(event: any) {
    this.webSelectedCompositionBasedStatistic = event.target.value;
  }

  onWebFormatObjectChange(event: any) {
    this.webSelectedFormatObject = event.target.value.trim();
  }

  runStandaloneQuery(
    requestBody: any,
    isMakeDb: boolean,
    callback?: (result: any) => void
  ) {
    let url = this.standaloneUrl;
    if (isMakeDb) {
      url += "/makeBlastDb";
    } else {
      url += "/blastn";
    }
    this._g.setLoadingStatus(true);
    this._g.statusMsg.next("Executing Blast query...");
    const errFn = (err: any) => {
      this._g.statusMsg.next("Blast query execution raised an error!");
      this._g.showErrorModal("Blast Query Execution Error", err.message);
      this._g.setLoadingStatus(false);
    };
    this._http.post(url, requestBody).subscribe((x) => {
      this._g.setLoadingStatus(false);
      if (x["errors"] && x["errors"].length > 0) {
        errFn(x["errors"][0]);
        return;
      }
      this._g.statusMsg.next("");
      if (callback) {
        callback(x);
      }
    }, errFn);
  }

  makeDb() {
    if (this._g.cy.nodes().length == 0) {
      this._g.showErrorModal("No nodes", "Please load a graph and try again.");
      return;
    }
    this.runStandaloneQuery(
      { fastaData: this._cyService.prepareAllNodesFastaData() },
      true,
      (res) => {
        this.standaloneDBStatus =
          "Succesfully added " +
          res.results.split("\n")[9].split(" ")[5] +
          " sequences.";
        setTimeout(() => {
          this.standaloneDBStatus = "";
        }, 10000);
      }
    );
  }

  executeStandaloneQueryWithParams() {
    if (!this.standaloneQuery) {
      this._g.showErrorModal(
        "No query sequence",
        "Please enter a query sequence and try again."
      );
      return;
    }
    this.runStandaloneQuery(
      {
        fastaData: this.standaloneQuery,
        commandLineArguments: this.standaloneCommandLineArguments,
      },
      false,
      (res) => {
        this.standaloneStatus = res.results;
        this.standaloneIsTableOutput = res.isFormat6;

        if (this.standaloneIsTableOutput) {
          this.fillStandaloneTableOutput();
        }
      }
    );
  }

  fillStandaloneTableOutput() {
    let lines = this.standaloneStatus.split("\n");
    this.standaloneTableOutput.results = [];
    let nextId = 1;

    for (let i = 0; i < lines.length; i++) {
      let row: TableData[] = [];
      let cols = lines[i].split("\t");
      row.push({ val: nextId++, type: TableDataType.string });
      row.push({ val: cols[0], type: TableDataType.string });
      row.push({ val: cols[1], type: TableDataType.string });
      row.push({ val: cols[2], type: TableDataType.number });
      row.push({ val: cols[3], type: TableDataType.number });
      row.push({ val: cols[4], type: TableDataType.number });
      row.push({ val: cols[5], type: TableDataType.number });
      row.push({ val: cols[6], type: TableDataType.number });
      row.push({ val: cols[7], type: TableDataType.number });
      row.push({ val: cols[8], type: TableDataType.number });
      row.push({ val: cols[9], type: TableDataType.number });
      row.push({ val: cols[10], type: TableDataType.number });
      row.push({ val: cols[11], type: TableDataType.number });
      this.standaloneTableOutput.results.push(row);
    }
    this.standaloneTableOutput.pageSize =
      this._g.userPrefs.dataPageSize.getValue();
    this.standaloneTableOutput.currPage = 1;
    this.standaloneTableOutput.resultCnt =
      this.standaloneTableOutput.results.length;
  }

  onStandaloneTableFilterChange(event: any) {}

  onStandaloneCommandLineArgumentsChange(event: any) {
    this.standaloneCommandLineArguments = event.target.value.trim();
  }

  saveResult() {
    if (this.selectedTypeIdx) {
      this._cyService.saveAsTxt(this.webResult, "blast_web_result.txt");
    } else {
      this._cyService.saveAsTxt(
        this.standaloneStatus,
        "blast_standalone_result.txt"
      );
    }
  }
}
