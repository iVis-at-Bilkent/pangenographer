import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { COLLAPSED_EDGE_CLASS } from "src/app/visuall/constants";
import { environment } from "src/environments/environment";
import {
  TableData,
  TableDataType,
  TableFiltering,
  TableViewInput,
  filterTableDatas,
} from "../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../cytoscape.service";
import { GlobalVariableService } from "../../../global-variable.service";
import {
  CombinedSequence,
  SequenceDataService,
} from "../../../sequence-data.service";

interface webDatabaseType {
  name: string;
  value: string;
  types: string[];
}

@Component({
  selector: "app-blast-tab",
  templateUrl: "./blast-tab.component.html",
  styleUrls: ["./blast-tab.component.css"],
})
export class BlastTabComponent implements OnInit {
  query: string = ""; // Query sequence for BLAST
  types: string[] = ["Standalone service", "Web service"]; // Types of service
  selectedType: string = "Standalone service"; // Selected type of service
  selectedTypeIndex: number = 0; // 0: Standalone service, 1: Web service, -1: Invalid type

  // Selected segments path finding variables
  selectedSegmentMap: any = {}; // Map of selected segments with their ids as keys
  selectedSegmentPaths: any[] = []; // Array of selected segments' paths
  currentSelectedSegmentPath: any[] = []; // Current selected segment path

  // Web service variables
  webDatabases: webDatabaseType[] = [
    {
      name: "Non-redundant nucleotide sequences (nt)",
      value: "nt",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Non-redundant protein sequences (nr)",
      value: "nr",
      types: ["blastn", "blastp", "blastx", "tblastn", "tblastx"],
    },
    {
      name: "RefSeq Select RNA sequences (refseq_select)",
      value: "refseq_select",
      types: ["blastn", "blastp", "blastx", "tblastn", "tblastx"],
    },
    {
      name: "Reference proteins (refseq_protein)",
      value: "refseq_protein",
      types: ["blastp", "blastx"],
    },
    {
      name: "Model Organisms (landmark)",
      value: "landmark",
      types: ["blastp", "blastx"],
    },
    {
      name: "Swiss-Prot (swissprot)",
      value: "swissprot",
      types: ["blastp", "blastx"],
    },
    {
      name: "Patended protein sequences (pataa)",
      value: "pataa",
      types: ["blastp", "blastx"],
    },
    {
      name: "Reference RNA sequences (refseq_rna)",
      value: "refseq_rna",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "RetSeq Representative genomes (retseq_representative_genomes)",
      value: "retseq_representative_genomes",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "RetSeq Genome Database (retseq_genomes)",
      value: "retseq_genomes",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Whole-genome shotgun contigs (wgs)",
      value: "wgs",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Expressed sequence tags (est)",
      value: "est",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Sequence Read Archive (SRA)",
      value: "SRA",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Transcriptome Shotgun Assembly (TSA)",
      value: "TSA",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Targeted Loci (TLS)",
      value: "TLS",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "High throughput genomic sequences (HTGS)",
      value: "HTGS",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Patent sequences (pat)",
      value: "pat",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Protein Data Bank (pdb)",
      value: "pdb",
      types: ["blastn", "blastp", "blastx", "tblastn", "tblastx"],
    },
    {
      name: "Metagenomic sequences (env_nr)",
      value: "env_nr",
      types: ["blastp", "blastx"],
    },
    {
      name: "Transcriptome Shotgun Assembly proteins (tsa_nr)",
      value: "tsa_nr",
      types: ["blastp", "blastx"],
    },
    {
      name: "Human RefSeqGene sequences(RefSeq_Gene)",
      value: "RefSeq_Gene",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Genomic survey sequences (gss)",
      value: "gss",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Sequence tagged sites (dbsts)",
      value: "dbsts",
      types: ["blastn", "tblastn", "tblastx"],
    },
  ];
  webSelectedDatabaseName: string = this.webDatabases[0].name;
  webSelectedDatabase: webDatabaseType = this.webDatabases[0];
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

  // Standalone service variables
  standaloneTableOutput: TableViewInput = {
    results: [],
    columns: [
      "Query Name",
      "Source Name",
      "Percent Identity",
      "Alignment Length",
      "Mis-matches",
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
    currentPage: 1,
    pageSize: 15,
    resultCount: 0,
    isNodeData: false,
    isShowExportAsCSV: false,
    isHide0: false,
    isUseCySelector4Highlight: true,
    isHideLoadGraph: true,
    isReplace_inHeaders: false,
    isDisableHover: false,
    tableTitle: "Blast Result",
    isEmphasizeOnHover: true,
    isBlastResultTable: true,
    allChecked: true,
  };
  standaloneQuery: string = "";
  standaloneResult: string = "";
  standaloneUrl: string = environment.blastStandaloneUrl;
  standaloneCommandLineArguments: string = "-outfmt 6";
  standaloneIsTableOutput: boolean = false;
  standaloneIsTableOutputFilled = new Subject<boolean>();
  standaloneClearTableOutputFilter = new Subject<boolean>();

  constructor(
    protected _http: HttpClient,
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService,
    private _sequenceDataService: SequenceDataService
  ) {}

  ngOnInit(): void {}

  // Fill query textarea with selected segments sequence
  fillQueryTextareaWithSelectedSegmentsSequence() {
    // Get selected segments
    const selectedSegments = this._g.cy.$(":selected").nodes();

    // Prepare selected segments sequence
    let selectedSegmentsSequence: string;

    // If no segment is selected, show error modal
    if (selectedSegments.length == 0) {
      this._g.showErrorModal(
        "No segments selected",
        "Please select segments and try again."
      );
      return;
    }
    // If segments are selected, prepare selected segments sequence
    // and prepare fasta data for the selected segments as a query
    // We prepare fasta data for the selected segment by getting the sequence data
    // and transforming it to an array of sequence names and sequences
    else {
      // Prepare paths for selected segments in dfs manner
      // We select a random node and find a path in selected segments
      // that can be reached from the random node or can reach to the random node
      // in a length of less than or equal to the selected segments path length option value
      // We repeat this process until there is no selected segment left
      this.preparePaths4SelectedSegments(selectedSegments);

      // Prepare selected segments sequence
      let sequencesOfSelectedPaths: string[] = [];

      for (let i = 0; i < this.selectedSegmentPaths.length; i++) {
        // If the path length is equal to 1, then we have a single segment
        // and we can directly add the sequence data to the selected segments sequence
        if (this.selectedSegmentPaths[i].length == 1) {
          this._sequenceDataService.pushSequenceData2Array(
            this.selectedSegmentPaths[i][0],
            sequencesOfSelectedPaths
          );
        }
        // Otherwise, we have multiple segments in the path
        // and we need to combine the sequence data of the segments in the path
        // to create a combined sequence for the selected segments path
        else {
          this.prepareCombinedSequenceFromPath(i, sequencesOfSelectedPaths);
        }
      }

      // Prepare selected segments sequence
      // by preparing fasta data for the selected segments as a query
      // We prepare fasta data for the selected segment by getting the sequence data
      // and transforming it to an array of sequence names and sequences
      selectedSegmentsSequence =
        this._sequenceDataService.prepareFastaData4SequenceArray(
          sequencesOfSelectedPaths
        );
    }

    // Set selected segments sequence to query textarea
    // to be shown to the user and used as a query
    this.query = selectedSegmentsSequence;
  }

  // Prepare combined sequence for selected segments path
  // by combining the sequence data of the segments in the path
  // to create a combined sequence for the selected segments path
  private prepareCombinedSequenceFromPath(
    index: number,
    sequencesOfSelectedPaths: string[]
  ) {
    // Get non-jump expanded edges between first two nodes in the path
    // as we need edges between nodes to get combined sequence data
    let edges = this.getNonJumpExpandedEdges(
      this.selectedSegmentPaths[index][0],
      this.selectedSegmentPaths[index][1]
    );

    // Get combined sequence from combined sequence object
    // which is prepared by combining the sequence data of the first two nodes
    let combinedSequence = this.getCombinedSequenceFromCombinedSequenceObject(
      this._sequenceDataService.prepareCombinedSequence(edges[0])
    );

    // Combine the sequence data of the first two nodes with the sequence data of the rest of the nodes
    for (let j = 2; j < this.selectedSegmentPaths[index].length; j++) {
      // Get non-jump expanded edges between current node and previous node
      // as we need edges between nodes to get combined sequence data
      edges = this.getNonJumpExpandedEdges(
        this.selectedSegmentPaths[index][j - 1],
        this.selectedSegmentPaths[index][j]
      );

      // Combine the sequence data of the current node with the combined sequence
      // by preparing a combined sequence object and getting the combined sequence
      // and updating the combined sequence
      combinedSequence = this.getCombinedSequenceFromCombinedSequenceObject(
        this._sequenceDataService.prepareCombinedSequence(
          edges[0],
          combinedSequence
        )
      );
    }

    // Prepare selected path name for selected segments path
    let selectedPathName = "";

    // Add segment names to selected path name for selected segments path
    // by concatenating the segment names of the segments in the path
    for (let i = 0; i < this.selectedSegmentPaths[index].length; i++) {
      selectedPathName +=
        this.selectedSegmentPaths[index][i].data("segmentName") + "_";
    }

    // Remove the last underscore from the selected path name
    selectedPathName = selectedPathName.slice(0, -1);

    // Add selected path name and combined sequence to sequences of selected paths array
    sequencesOfSelectedPaths.push(selectedPathName);
    sequencesOfSelectedPaths.push(combinedSequence);
  }

  // Get combined sequence from combined sequence object
  // by concatenating first, second and third sequencess
  private getCombinedSequenceFromCombinedSequenceObject(
    combinedSequenceObject: CombinedSequence
  ): string {
    return (
      combinedSequenceObject.firstSequence +
      combinedSequenceObject.secondSequence +
      combinedSequenceObject.thirdSequence
    );
  }

  // Prepare paths for selected segments in dfs manner
  // We select a random node and find a path in selected segments
  // that can be reached from the random node or can reach to the random node
  // in a length of less than or equal to the selected segments path length option value
  // We repeat this process until there is no selected segment left
  private preparePaths4SelectedSegments(selectedSegments: any[]) {
    this.selectedSegmentMap = {}; // Map of selected segments with their ids as keys
    this.selectedSegmentPaths = []; // Array of selected segments' paths

    // Add selected segments to selected segment map
    selectedSegments.forEach((element: any) => {
      this.selectedSegmentMap[element.id()] = element;
    });

    // Create selected segments array from selected segment map
    // to check if there is any selected segment left
    let selectedSegmentsArray = Object.values(this.selectedSegmentMap);

    // Repeat the process until there is no selected segment left
    while (selectedSegmentsArray.length > 0) {
      // Select a random node from selected segments array
      let element: any = selectedSegmentsArray[0];

      // Prepare selected segments path for the random node
      this.currentSelectedSegmentPath = [element];

      // Remove the element from selected segment map
      delete this.selectedSegmentMap[element.id()];

      // Recursively find a path in selected segments in dfs manner
      // First incomers then outgoers

      // Filter incomers that are not selected segments and recurse
      // We select the first incomer randomly and recurse
      let incomers = this.getFilteredNodes(element.incomers());
      if (incomers.length) {
        this.recurseSelectedSegmentsPath(incomers[0], false);
      }

      this.currentSelectedSegmentPath.reverse();

      // Filter outgoers that are not selected segments
      // We select the first outgoer randomly and recurse
      let outgoers = this.getFilteredNodes(element.outgoers());
      if (outgoers.length) {
        this.recurseSelectedSegmentsPath(outgoers[0], true);
      }

      // Add the current selected segment path to selected segment paths
      // This is a path that can be reached from the random node or can reach to the random node
      // in a length of less than or equal to the selected segments path length option value
      this.selectedSegmentPaths.push(this.currentSelectedSegmentPath);

      // Update selected segments array to check if there is any selected segment left
      selectedSegmentsArray = Object.values(this.selectedSegmentMap);
    }
  }

  // Recursively find a path in selected segments in dfs manner
  private recurseSelectedSegmentsPath(element: any, isOutgoer: boolean) {
    // If the path length is equal to the length of selected segments path option
    // then we have found a path and we don't need to recurse further
    if (
      this.currentSelectedSegmentPath.length ==
      this._g.userPreferences.pangenographer.lengthOfBlastSelectedSegmentsPath.getValue()
    ) {
      return;
    }

    // Add the element to the current selected segment path
    this.currentSelectedSegmentPath.push(element);
    // Remove the element from selected segment map
    delete this.selectedSegmentMap[element.id()];

    // Get filtered nodes for outgoers or incomers of the element
    // as we recurse outgoers or incomers of the element
    // We don't want to include nodes that are not selected segments
    // or nodes that have jump edges, because jump edges do not have sequence data
    let nodes: any[];
    if (isOutgoer) {
      nodes = this.getFilteredNodes(element.outgoers().nodes());
    } else {
      nodes = this.getFilteredNodes(element.incomers().nodes());
    }

    // Recurse the first node in filtered nodes if there is any
    if (nodes.length) {
      this.recurseSelectedSegmentsPath(nodes[0], isOutgoer);
    }
  }

  // Get filtered nodes for selected segments
  // Filtered nodes are nodes that have non-jump edges
  // and are selected segments
  // We don't want to include nodes that are not selected segments
  // or nodes that have jump edges, because jump edges do not have sequence data
  private getFilteredNodes(nodes: any[]) {
    return nodes.filter(
      (node: any) =>
        this.selectedSegmentMap[node.id()] &&
        this.getNonJumpExpandedEdges(node).length
    );
  }

  // Get non-jump expanded edges between nodes
  // This function is used for selected segments path finding
  // If node2 is not provided, get last node of current selected segment path
  private getNonJumpExpandedEdges(node1: any, node2?: any) {
    // If node2 is not provided, get non-jump edges of node1
    // and last node of current selected segment path
    // because we are looking for non-jump edges between selected segments
    // Otherwise, get non-jump edges between node1 and node2
    node2 =
      node2 ||
      this.currentSelectedSegmentPath[
        this.currentSelectedSegmentPath.length - 1
      ];

    // Get all edges between node1 and node2 and filter non-jump edges
    let edges = node1
      .edgesTo(node2)
      .union(node2.edgesTo(node1))
      .filter((x: any) => !x.data("distance"));

    // Get collapsed edges in filtered edges
    let collapsedEdges = edges.filter((x: any) =>
      x.hasClass(COLLAPSED_EDGE_CLASS)
    );
    // Get non-collapsed edges in filtered edges
    edges = edges.difference(collapsedEdges);

    // Get all edges of collapsed edges and add them to non-collapsed edges
    for (let edge of collapsedEdges) {
      edges = edges.union(edge.data("collapsedEdges"));
    }

    return edges;
  }

  // Set the query sequence for BLAST
  onQueryChange(event: any) {
    this.query = event.target.value.trim();
  }

  // Set the selected type of service for BLAST
  onchangeTypeChange(event: any) {
    // Set the selected type of service
    this.selectedType = event.target.value;
    if (this.selectedType === "Standalone service") {
      this.selectedTypeIndex = 0;
    } else if (this.selectedType === "Web service") {
      this.selectedTypeIndex = 1;
    } else {
      this.selectedTypeIndex = -1; // Invalid type
    }

    // Clear the blast tab
    this.clearTheBlastTab();
  }

  // Clear the blast tab by clearing the standalone and web outputs and query sequence
  private clearTheBlastTab() {
    // Clear the standalone output
    this.standaloneResult = "";
    // Close the table output if it is open
    this.standaloneIsTableOutput = false;
    this.standaloneIsTableOutputFilled.next(false);
    this.standaloneClearTableOutputFilter.next(true);
    this.standaloneTableOutput.results = [];

    // Clear the web output
    this.webResult = "";

    // Reset the query sequence
    this.query = "";
  }

  private runWebBlastQuery(queryParams: string, callback: (x: any) => any) {
    const url = "https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?";
    this._g.setLoadingStatus(true);
    const q = url + queryParams;
    console.log(q);
    this._g.statusMsg.next("Executing BLAST query...");

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
    if (this.webSelectedDatabaseName) {
      queryParams += "&DATABASE=" + this.webSelectedDatabase.value;
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
    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/^    RID = (.*)$/m);
      this.webRid = match && match[1];
      match = result.match(/^    RTOE = (.*)$/m);
      this.webRtoe = match && match[1];
      this._g.statusMsg.next("BLAST query submitted successfully");
    });
  }

  checkWebBlastQueryStatus() {
    let queryParams = "CMD=Get&RID=" + this.webRid;
    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/Status=(\w+)/);
      this.webStatus = match && match[1];
      this._g.statusMsg.next("BLAST query checked successfully");
    });
  }

  getWebBlastQueryResult() {
    let queryParams = "CMD=Get&RID=" + this.webRid + "&VIEW_RESULTS=FromRes";
    queryParams += "&FORMAT_TYPE=" + this.webSelectedFormatType;
    this.runWebBlastQuery(queryParams, (result: any) => {
      this.webResult = result;
      this._g.statusMsg.next("BLAST query result retrieved successfully");
    });
  }

  // Set web database for selected program
  // Set selected database object for selected database name
  onWebDatabaseChange(event: any) {
    this.webSelectedDatabaseName = event.target.value.trim();
    this.webSelectedDatabase = this.webDatabases.find(
      (x) => x.name === this.webSelectedDatabaseName
    );
  }

  // Get web databases for selected program
  getWebDatabasesNameForSelectedProgram() {
    return this.webDatabases
      .filter((x) => x.types.includes(this.webSelectedProgram))
      .map((x) => x.name);
  }

  // Set web database for selected program
  // Set default database for selected program
  onWebProgramChange(event: any) {
    this.webSelectedProgram = event.target.value.trim();

    if (
      this.webSelectedProgram === "blastp" ||
      this.webSelectedProgram === "blastx"
    ) {
      this.onWebDatabaseChange({
        target: { value: this.webDatabases[1].name },
      });
    } else {
      this.onWebDatabaseChange({
        target: { value: this.webDatabases[0].name },
      });
    }
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
    this._g.statusMsg.next("Executing BLAST query...");
    const errFn = (err: any) => {
      this._g.statusMsg.next("BLAST Query Execution Raised an Error!");
      this._g.showErrorModal("BLAST Query Execution Error", err.message);
      this._g.setLoadingStatus(false);
    };
    this._http.post(url, requestBody).subscribe((x) => {
      this._g.setLoadingStatus(false);
      if (x["errors"] && x["errors"].length > 0) {
        errFn(x["errors"][0]);
        return;
      }

      this._g.statusMsg.next("BLAST Query Execution Completed Successfully!");

      if (callback) {
        callback(x);
      }
    }, errFn);
  }

  // Create database from all nodes in the graph by preparing fasta data for the nodes
  createDatabase() {
    // Check if there are any nodes in the graph
    if (this._g.cy.nodes().length == 0) {
      this._g.showErrorModal("No nodes", "Please load a graph and try again.");
      return;
    }

    // Run standalone query to create database from all nodes in the graph
    this.runStandaloneQuery(
      {
        // Prepare fasta data for all nodes in the graph
        //  by preparing fasta data for the sequence array of the nodes in the graph
        fastaData: this._sequenceDataService.prepareFastaData4SequenceArray(
          this._sequenceDataService.nodeDatas2SequenceArray(this._g.cy.nodes())
        ),
      },
      true, // Make database flag
      (res) => {
        // Show status message for the number of sequences added to the database
        this._g.statusMsg.next(
          "Succesfully added " +
            res.results.split("\n")[9].split(" ")[5] +
            " sequences "
        );
      }
    );
  }

  executeStandaloneQueryWithParams() {
    if (!this.query) {
      this._g.showErrorModal(
        "No query sequence",
        "Please enter a query sequence and try again."
      );
      return;
    }
    this.runStandaloneQuery(
      {
        fastaData: this.query,
        commandLineArguments: this.standaloneCommandLineArguments,
      },
      false,
      (res) => {
        this.standaloneResult = res.results;
        this.standaloneIsTableOutput = res.isFormat6;

        if (this.standaloneIsTableOutput) {
          this.onStandaloneTableFilterChange({
            txt: "",
            orderBy: "Query Name",
            orderDirection: "asc",
          });
        } else {
          this.standaloneTableOutput.results = [];
          this.standaloneIsTableOutputFilled.next(false);
        }
      }
    );
  }

  fillStandaloneTableOutput() {
    let lines = this.standaloneResult.split("\n");
    this.standaloneTableOutput.results = [];
    let id = 0;

    for (let i = 0; i < lines.length; i++) {
      // Prepare row for the table output
      let row: TableData[] = [];
      // Split the line by tab to get columns of the row
      let cols = lines[i].trim().split("\t");
      // If the number of columns is equal to 12, then add the row to the table output
      // Otherwise, ignore the row as it is not a valid row
      if (cols.length == 12) {
        // Id for the row
        row.push({ value: id++, type: TableDataType.number });
        // Query name
        row.push({ value: cols[0], type: TableDataType.string });
        // Source name
        row.push({ value: cols[1], type: TableDataType.string });
        // Percent identity
        row.push({ value: cols[2], type: TableDataType.number });
        // Alignment length
        row.push({ value: cols[3], type: TableDataType.number });
        // Mis-matches
        row.push({ value: cols[4], type: TableDataType.number });
        // Gap opens
        row.push({ value: cols[5], type: TableDataType.number });
        // Query start
        row.push({ value: cols[6], type: TableDataType.number });
        // Query end
        row.push({ value: cols[7], type: TableDataType.number });
        // Source start
        row.push({ value: cols[8], type: TableDataType.number });
        // Source end
        row.push({ value: cols[9], type: TableDataType.number });
        // E-value
        row.push({ value: cols[10], type: TableDataType.string });
        // Bit score
        row.push({ value: cols[11], type: TableDataType.number });

        // Add the row to the table output
        this.standaloneTableOutput.results.push(row);
      }
    }
    this.standaloneTableOutput.pageSize =
      this._g.userPreferences.dataPageSize.getValue();
    this.standaloneTableOutput.currentPage = 1;
    this.standaloneTableOutput.resultCount =
      this.standaloneTableOutput.results.length;

    this.standaloneIsTableOutputFilled.next(true);
    this.standaloneClearTableOutputFilter.next(true);
  }

  onStandaloneTableFilterChange(filter: TableFiltering) {
    this.standaloneIsTableOutputFilled.next(false);
    this.fillStandaloneTableOutput();
    filterTableDatas(
      filter,
      this.standaloneTableOutput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );
    setTimeout(() => {
      this.standaloneIsTableOutputFilled.next(true);
    }, 100);
  }

  onStandaloneCommandLineArgumentsChange(event: any) {
    this.standaloneCommandLineArguments = event.target.value.trim();
  }

  // Save the results of the BLAST as a text file with the name blast_<web/standalone>_result.txt
  saveResults() {
    if (this.selectedTypeIndex) {
      this._cyService.saveAsTxt(this.webResult, "blast_web_result.txt");
    } else {
      this._cyService.saveAsTxt(
        this.standaloneResult,
        "blast_standalone_result.txt"
      );
    }
  }
}
