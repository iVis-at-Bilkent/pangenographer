import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { environment } from "src/environments/environment";
import { CytoscapeService } from "../../../cytoscape.service";
import { GlobalVariableService } from "../../../global-variable.service";

@Component({
  selector: "app-blast-tab",
  templateUrl: "./blast-tab.component.html",
  styleUrls: ["./blast-tab.component.css"],
})
export class BlastTabComponent implements OnInit {
  query: string = "";
  database: string = "nr";
  programs: string[] = ["blastn", "blastp", "blastx", "tblastn", "tblastx"];
  selectedProgram: string = "blastn";
  selectedProgramIdx: number = 0;
  enableMegaBlast: boolean = false;
  filters: string[] = ["F", "T", "L", "mT", "mL"];
  selectedFilter: string = "F";
  selectedFilterIdx: number = 0;
  formatTypes: string[] = ["Text", "HTML", "XML", "XML2", "JSON2", "Tabular"];
  selectedFormatType: string = "HTML";
  selectedFormatTypeIdx: number = 0;
  expect: number = 0;
  nulceotideReward: number = 0;
  nucleotidePenalty: number = 0;
  gapCost: string = "";
  matrixs: string[] = [
    "BLOSUM45",
    "BLOSUM50",
    "BLOSUM62",
    "BLOSUM80",
    "BLOSUM90",
    "PAM250",
    "PAM30",
    "PAM70",
  ];
  selectedMatrix: string = "BLOSUM62";
  selectedMatrixIdx: number = 2;
  hitlistSize: number = 0;
  descriptions: number = 0;
  alignments: number = 0;
  ncbiGenInfos: string[] = ["T", "F"];
  selectedNCBIGenInfo: string = "T";
  selectedNCBIGenInfoIdx: number = 0;
  rid: string = "";
  rtoe: number = undefined;
  status: string = "";
  threshold: number = 0;
  wordSize: number = 0;
  compositionBasedStatistics: number[] = [-1, 0, 1, 2, 3];
  selectedCompositionBasedStatistic: number = -1;
  selectedCompositionBasedStatisticsIdx: number = 0;
  formatObjects: string[] = ["SearchInfo", "Alignments"];
  selectedFormatObject: string = "SearchInfo";
  selectedFormatObjectIdx: number = 0;
  result: string = "";
  resultTableInput: string = "";

  standaloneQuery: string = "";
  standaloneStatus: string = "";
  standaloneUrl: string = environment.blastStandaloneUrl;

  constructor(
    protected _http: HttpClient,
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService
  ) {}

  ngOnInit(): void {}

  private runBlastQuery(queryParams: string, callback: (x: any) => any) {
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

  executeBlastQueryWithParams() {
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
    if (this.database) {
      queryParams += "&DATABASE=" + this.database;
    } else {
      this._g.showErrorModal(
        "No database selected",
        "Please select a database and try again."
      );
      return;
    }
    if (this.selectedProgram) {
      queryParams += "&PROGRAM=" + this.selectedProgram;
    } else {
      this._g.showErrorModal(
        "No program selected",
        "Please select a program and try again."
      );
      return;
    }
    if (this.enableMegaBlast) {
      queryParams += "&MEGABLAST=on";
    }
    if (this.selectedFilter && this.selectedFilter != "F") {
      queryParams += "&FILTER=" + this.selectedFilter;
    }
    if (this.selectedFormatType) {
      queryParams += "&FORMAT_TYPE=" + this.selectedFormatType;
    }
    if (this.expect) {
      queryParams += "&EXPECT=" + this.expect;
    }
    if (this.nulceotideReward) {
      queryParams += "&NUCL_REWARD=" + this.nulceotideReward;
    }
    if (this.nucleotidePenalty) {
      queryParams += "&NUCL_PENALTY=" + this.nucleotidePenalty;
    }
    if (this.gapCost) {
      queryParams += "&GAPCOSTS=" + this.gapCost;
    }
    queryParams += "&MATRIX_NAME=" + this.selectedMatrix;
    if (this.hitlistSize) {
      queryParams += "&HITLIST_SIZE=" + this.hitlistSize;
    }
    if (this.descriptions) {
      queryParams += "&DESCRIPTIONS=" + this.descriptions;
    }
    if (this.alignments) {
      queryParams += "&ALIGNMENTS=" + this.alignments;
    }
    queryParams += "&NCBI_GI=" + this.selectedNCBIGenInfo;
    if (this.threshold) {
      queryParams += "&THRESHOLD=" + this.threshold;
    }
    if (this.wordSize) {
      queryParams += "&WORD_SIZE=" + this.wordSize;
    }
    if (this.selectedCompositionBasedStatistic != -1) {
      queryParams +=
        "&COMPOSITION_BASED_STATISTICS=" +
        this.selectedCompositionBasedStatistic;
    }
    console.log(queryParams.replace(/&/g, "\n"));
    this.runBlastQuery(queryParams, (result: any) => {
      let match = result.match(/^    RID = (.*)$/m);
      this.rid = match && match[1];
      console.log(match);
      match = result.match(/^    RTOE = (.*)$/m);
      this.rtoe = match && match[1];
      console.log(match);
      console.log(this.rid);
      console.log(this.rtoe);
      this._g.statusMsg.next("Blast query submitted successfully.");
    });
  }

  checkBlastQueryStatus() {
    let queryParams = "CMD=Get&RID=" + this.rid;
    this.runBlastQuery(queryParams, (result: any) => {
      let match = result.match(/Status=(\w+)/);
      this.status = match && match[1];
      console.log(result);
      console.log(match);
      console.log(this.status);
      this._g.statusMsg.next("Blast query checked successfully.");
    });
  }

  getBlastQueryResult() {
    let queryParams = "CMD=Get&RID=" + this.rid + "&VIEW_RESULTS=FromRes";
    queryParams += "&FORMAT_TYPE=" + this.selectedFormatType;
    this.runBlastQuery(queryParams, (result: any) => {
      this.result = result;
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

  onDatabaseChange(event: any) {
    this.database = event.target.value.trim();
  }

  onProgramChange(event: any) {
    this.selectedProgramIdx = event.target.selectedIndex;
    this.selectedProgram = this.programs[this.selectedProgramIdx];
  }

  onMegaBlastChange(event: any) {
    this.enableMegaBlast = event.target.checked;
  }

  onFilterChange(event: any) {
    this.selectedFilterIdx = event.target.selectedIndex;
    this.selectedFilter = this.filters[this.selectedFilterIdx];
  }

  onFormatTypeChange(event: any) {
    this.selectedFormatTypeIdx = event.target.selectedIndex;
    this.selectedFormatType = this.formatTypes[this.selectedFormatTypeIdx];
  }

  onExpectChange(event: any) {
    this.expect = event.target.value.trim();
  }

  onNucleotideRewardChange(event: any) {
    this.nulceotideReward = event.target.value.trim();
  }

  onNucleotidePenaltyChange(event: any) {
    this.nucleotidePenalty = event.target.value.trim();
  }

  onGapCostChange(event: any) {
    this.gapCost = event.target.value.trim();
  }

  onMatrixChange(event: any) {
    this.selectedMatrixIdx = event.target.selectedIndex;
    this.selectedMatrix = this.matrixs[this.selectedMatrixIdx];
  }

  onHitlistSizeChange(event: any) {
    this.hitlistSize = event.target.value.trim();
  }

  onDescriptionsChange(event: any) {
    this.descriptions = event.target.value.trim();
  }

  onAlignmentsChange(event: any) {
    this.alignments = event.target.value.trim();
  }

  onNCBIGenInfoChange(event: any) {
    this.selectedNCBIGenInfoIdx = event.target.selectedIndex;
    this.selectedNCBIGenInfo = this.ncbiGenInfos[this.selectedNCBIGenInfoIdx];
  }

  onRIDChange(event: any) {
    this.rid = event.target.value.trim();
  }

  onThresholdChange(event: any) {
    this.threshold = event.target.value.trim();
  }

  onWordSizeChange(event: any) {
    this.wordSize = event.target.value.trim();
  }

  onCompositionBasedStatisticsChange(event: any) {
    this.selectedCompositionBasedStatisticsIdx = event.target.selectedIndex;
    this.selectedCompositionBasedStatistic =
      this.compositionBasedStatistics[
        this.selectedCompositionBasedStatisticsIdx
      ];
  }

  onFormatObjectChange(event: any) {
    this.selectedFormatObjectIdx = event.target.selectedIndex;
    this.selectedFormatObject =
      this.formatObjects[this.selectedFormatObjectIdx];
  }

  runBlastStandaloneQuery(
    requestBody: any,
    isMakeDb: boolean,
    callback?: (result: string) => void
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
        callback(x["results"]);
      }
    }, errFn);
  }

  makeBlastDb() {
    this.runBlastStandaloneQuery(
      { fastaData: this._cyService.prepareAllNodesFastaData() },
      true,
      (result) => {
        this.standaloneStatus = result;
      }
    );
  }

  executeStandaloneBlastQueryWithParams() {
    if (!this.standaloneQuery) {
      this._g.showErrorModal(
        "No query sequence",
        "Please enter a query sequence and try again."
      );
      return;
    }
    this.runBlastStandaloneQuery(
      {
        fastaData: this.standaloneQuery,
      },
      false,
      (result) => {
        this.standaloneStatus = result;
      }
    );
  }
}
