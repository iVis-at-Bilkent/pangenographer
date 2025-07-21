import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { COLLAPSED_EDGE_CLASS } from "src/app/visuall/constants";
import { environment } from "src/environments/environment";
import {
  TableData,
  TableFiltering,
  TableViewInput,
  filterTableData,
} from "../../../../shared/table-view/table-view-types";
import { CytoscapeService } from "../../../cytoscape.service";
import { DbAdapterService } from "../../../db-service/db-adapter.service";
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
  selectedSegmentMap: any = {};
  selectedSegmentPaths: any[] = [];
  currentSelectedSegmentPath: any[] = [];

  // Web service variables
  webDatabases: webDatabaseType[] = [
    {
      name: "Core nucleotide database (core_nt)",
      value: "core_nt",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Non-redundant protein sequences (nr)",
      value: "nr",
      types: ["blastp", "blastx"],
    },
    {
      name: "RefSeq Select proteins (refseq_select)",
      value: "refseq_select",
      types: ["blastp", "blastx"],
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
      name: "UniProtKB/Swiss-Prot (swissprot)",
      value: "swissprot",
      types: ["blastp", "blastx"],
    },
    {
      name: "Patented protein sequences (pataa)",
      value: "pataa",
      types: ["blastp", "blastx"],
    },
    {
      name: "Protein Data Bank proteins (pdb)",
      value: "pdb", 
      types: ["blastp", "blastx"],
    },
    {
      name: "Metagenomic proteins (env_nr)",
      value: "env_nr",
      types: ["blastp", "blastx"],
    },
    {
      name: "Trancriptome Shotgun Assembly proteins (tsa_nr)",
      value: "tsa_nr",
      types: ["blastp", "blastx"],
    },
    {
      name: "RefSeq Select RNA sequences (refseq_select)",
      value: "refseq_select",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Reference RNA sequences (refseq_rna)",
      value: "refseq_rna",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "RefSeq Reference genomes (refseq_reference_genomes)",
      value: "refseq_reference_genomes",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "RefSeq Genome Database (refseq_genomes)",
      value: "refseq_genomes",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Nucleotide collection (nr/nt)",
      value: "nt",
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
      name: "PDB nucleotide sequences (pdb)",
      value: "pdb",
      types: ["blastn", "tblastn", "tblastx"],
    },
    {
      name: "Human RefSeqGene sequences (RefSeq_Gene)",
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
  webNucleotideReward: number = 0;
  webNucleotidePenalty: number = 0;
  webGapCost: string = "";
  webMatrixes: string[] = [
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
  standaloneTableInput: TableViewInput = {
    results: [],
    columns: [
      "Query name",
      "Source name",
      "Percent identity",
      "Alignment length",
      "Mis-matches",
      "Gap opens",
      "Query start",
      "Query end",
      "Source start",
      "Source end",
      "E-value",
      "Bit score",
    ],
    isLoadGraph: false,
    isMergeGraph: false,
    currentPage: 1,
    pageSize: 15,
    resultCount: 0,
    isNodeData: false,
    isShowExportAsCSV: false,
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
  standaloneIsTableInput: boolean = false;
  standaloneIsTableInputFilled = new Subject<boolean>();
  standaloneClearTableOutputFilter = new Subject<boolean>();
  standaloneSegmentNames2Add2DB: string = "";
  standaloneFastaData2CreateDB: string = "";

  constructor(
    protected _http: HttpClient,
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService,
    private _sequenceDataService: SequenceDataService,
    private _dbService: DbAdapterService
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
  // by concatenating first, second and third sequences
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
      this._g.userPreferences.lengthOfBlastSelectedSegmentsPath.getValue()
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
    this.standaloneIsTableInput = false;
    this.standaloneIsTableInputFilled.next(false);
    this.standaloneClearTableOutputFilter.next(true);
    this.standaloneTableInput.results = [];

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
    this._g.statusMessage.next("Executing BLAST query...");

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
      queryParams += "&QUERY=" + encodeURIComponent(this.query);
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
    if (this.webNucleotideReward) {
      queryParams += "&NUCL_REWARD=" + this.webNucleotideReward;
    }
    if (this.webNucleotideReward) {
      queryParams += "&NUCL_PENALTY=" + this.webNucleotideReward;
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

    console.log(queryParams);

    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/^    RID = (.*)$/m);
      this.webRid = match && match[1];
      match = result.match(/^    RTOE = (.*)$/m);
      this.webRtoe = match && match[1];
      this._g.statusMessage.next("BLAST query submitted successfully");
    });
  }

  checkWebBlastQueryStatus() {
    let queryParams = "CMD=Get&RID=" + this.webRid;
    this.runWebBlastQuery(queryParams, (result: any) => {
      let match = result.match(/Status=(\w+)/);
      this.webStatus = match && match[1];
      this._g.statusMessage.next("BLAST query checked successfully");
    });
  }

  getWebBlastQueryResult() {
    let queryParams = "CMD=Get&RID=" + this.webRid + "&VIEW_RESULTS=FromRes";
    queryParams += "&FORMAT_TYPE=" + this.webSelectedFormatType;
    this.runWebBlastQuery(queryParams, (result: any) => {
      this.webResult = result;
      this._g.statusMessage.next("BLAST query result retrieved successfully");
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
    this.webNucleotideReward = event.target.value.trim();
  }

  onWebNucleotidePenaltyChange(event: any) {
    this.webNucleotideReward = event.target.value.trim();
  }

  onWebGapCostChange(event: any) {
    this.webGapCost = event.target.value.trim();
  }

  onWebMatrixChange(event: any) {
    this.webSelectedMatrixIdx = event.target.selectedIndex;
    this.webSelectedMatrix = this.webMatrixes[this.webSelectedMatrixIdx];
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
    this._g.statusMessage.next("Executing BLAST query...");
    const errFn = (err: any) => {
      this._g.statusMessage.next("BLAST Query Execution Raised an Error!");
      this._g.showErrorModal("BLAST Query Execution Error", err.message);
      this._g.setLoadingStatus(false);
    };
    this._http.post(url, requestBody).subscribe((x) => {
      this._g.setLoadingStatus(false);
      if (x["errors"] && x["errors"].length > 0) {
        errFn(x["errors"][0]);
        return;
      }

      this._g.statusMessage.next(
        "BLAST Query Execution Completed Successfully!"
      );

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
        fastaData: this.standaloneFastaData2CreateDB,
      },
      true, // Make database flag
      (res) => {
        // Show status message for the number of sequences added to the database
        this._g.statusMessage.next(
          "Succesfully added " +
            res.results.split("\n")[9].split(" ")[5] +
            " sequences "
        );
      }
    );
  }

  // Add selected segments to the database by preparing fasta data for the selected segments
  addSelectedSegment2DBCreation() {
    if (!this._g.cy.nodes(":selected").length) {
      this._g.showErrorModal(
        "No segments selected",
        "Please select segments and try again."
      );
      return;
    }

    // Sequence names for selected nodes

    let selectedNodeSegmentNames = this._g.cy
      .nodes(":selected")
      .map((x: any) => x.data("segmentName"));
    let splitStandaloneNames =
      this.standaloneSegmentNames2Add2DB.split(/[,|\n]+/);

    // Prepare selected nodes segment names
    // and adding the segment names to the standalone segment names to add to the database
    selectedNodeSegmentNames.forEach((segmentName: string) => {
      if (!splitStandaloneNames.includes(segmentName)) {
        this.standaloneSegmentNames2Add2DB += "\n" + segmentName;
      }
    });
    // Remove the leading whitespace
    this.standaloneSegmentNames2Add2DB =
      this.standaloneSegmentNames2Add2DB.trim();

    // Sequence data for selected nodes

    let selectedNodesFasta =
      this._sequenceDataService.prepareFastaData4SequenceArray(
        this._sequenceDataService.nodeData2SequenceArray(
          this._g.cy.nodes(":selected")
        )
      );

    // Prepare selected nodes fasta headers and sequences by splitting the selected nodes fasta data
    // and adding the headers and sequences to the selected nodes fasta headers and sequences arrays
    // We ignore the empty lines and the lines that are already in the standalone fasta data to add to the database
    let selectedNodesFastaHeaders = [];
    let selectedNodesFastaSequences = [];
    let splitStandaloneFastaData2CreateDB =
      this.standaloneFastaData2CreateDB.split("\n");
    selectedNodesFasta.split("\n").forEach((line: string) => {
      if (!line || splitStandaloneFastaData2CreateDB.includes(line)) {
        return;
      }

      if (line.startsWith(">")) {
        selectedNodesFastaHeaders.push(line);
      } else {
        selectedNodesFastaSequences.push(line);
      }
    });

    // Finally, add the selected nodes fasta headers and sequences to the standalone fasta data to add to the database
    for (let i = 0; i < selectedNodesFastaHeaders.length; i++) {
      this.standaloneFastaData2CreateDB +=
        "\n" +
        selectedNodesFastaHeaders[i] +
        "\n" +
        selectedNodesFastaSequences[i];
    }
    this.standaloneFastaData2CreateDB =
      this.standaloneFastaData2CreateDB.trim();
  }

  // Add new entered segment names to the database creation
  updateSequenceData4DBGeneration() {
    // Split the entered segment names by comma or newline
    let splitStandaloneSegmentNames =
      this.standaloneSegmentNames2Add2DB.split(/[,|\n]+/);
    let splitStandaloneFastaData2CreateDBHeaders =
      this.standaloneFastaData2CreateDB
        .split("\n")
        .filter((x) => x.startsWith(">"));

    let segmentsNames2Fetch = [];

    // Loop through the split segment names to check whether the segments sequence data is already in the standalone fasta data to add to the database
    for (let i = 0; i < splitStandaloneSegmentNames.length; i++) {
      // Check if the segment name is already in the standalone fasta data to add to the database
      if (
        splitStandaloneFastaData2CreateDBHeaders.includes(
          ">" + splitStandaloneSegmentNames[i]
        )
      ) {
        continue;
      }

      // Find the node in the graph with the segment name
      let newNode = this._g.cy.nodes().find((x: any) => {
        return x.data("segmentName") === splitStandaloneSegmentNames[i];
      });

      // Add the segment name and sequence data to the standalone fasta data to add to the database
      if (newNode) {
        this.standaloneFastaData2CreateDB +=
          "\n" +
          ">" +
          newNode.data("segmentName") +
          "\n" +
          newNode.data("segmentData");
      }
      // Add the segment name to the segments names to fetch
      else {
        segmentsNames2Fetch.push(splitStandaloneSegmentNames[i]);
      }
    }

    // Fetch the sequence data for the segment names to fetch
    if (segmentsNames2Fetch.length) {
      this._dbService.getSegmentsByNames(segmentsNames2Fetch, (res) => {
        res.nodes.forEach((node: any) => {
          this.standaloneFastaData2CreateDB +=
            "\n" +
            ">" +
            node.properties.segmentName +
            "\n" +
            node.properties.segmentData;
        });

        this._g.statusMessage.next(
          "Successfully added " +
            res.nodes.length +
            " sequences to the BLAST database creation"
        );

        this.standaloneFastaData2CreateDB =
          this.standaloneFastaData2CreateDB.trim();
      });
    }
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
        this.standaloneIsTableInput = res.isFormat6;

        if (res.results.trim() === "") {
          this.standaloneIsTableInput = false;
          this.standaloneResult = "No results found";
        }

        if (this.standaloneIsTableInput) {
          this.onStandaloneTableFilterChange({
            txt: "",
            orderBy: "Query Name",
            orderDirection: "asc",
          });
        } else {
          this.standaloneTableInput.results = [];
          this.standaloneIsTableInputFilled.next(false);
        }
      }
    );
  }

  fillStandaloneTableOutput() {
    let lines = this.standaloneResult.split("\n");
    this.standaloneTableInput.results = [];
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
        row.push({ value: id++ });
        // Query name
        row.push({ value: cols[0] });
        // Source name
        row.push({ value: cols[1] });
        // Percent identity
        row.push({ value: cols[2] });
        // Alignment length
        row.push({ value: cols[3] });
        // Mis-matches
        row.push({ value: cols[4] });
        // Gap opens
        row.push({ value: cols[5] });
        // Query start
        row.push({ value: cols[6] });
        // Query end
        row.push({ value: cols[7] });
        // Source start
        row.push({ value: cols[8] });
        // Source end
        row.push({ value: cols[9] });
        // E-value
        row.push({ value: cols[10] });
        // Bit score
        row.push({ value: cols[11] });

        // Add the row to the table output
        this.standaloneTableInput.results.push(row);
      }
    }
    this.standaloneTableInput.pageSize =
      this._g.userPreferences.queryResultPageSize.getValue();
    this.standaloneTableInput.currentPage = 1;
    this.standaloneTableInput.resultCount =
      this.standaloneTableInput.results.length;

    this.standaloneIsTableInputFilled.next(true);
    this.standaloneClearTableOutputFilter.next(true);
  }

  onStandaloneTableFilterChange(filter: TableFiltering) {
    this.standaloneIsTableInputFilled.next(false);
    this.fillStandaloneTableOutput();
    filterTableData(
      filter,
      this.standaloneTableInput,
      this._g.userPreferences.isIgnoreCaseInText.getValue()
    );

    setTimeout(() => {
      this.standaloneIsTableInputFilled.next(true);
    }, 100);
  }

  onStandaloneCommandLineArgumentsChange(event: any) {
    this.standaloneCommandLineArguments = event.target.value.trim();
  }

  onStandaloneSegmentNames2Add2DBChange(event: any) {
    this.standaloneSegmentNames2Add2DB = event.target.value.trim();
  }

  onStandaloneFastaData2CreateDBChange(event: any) {
    this.standaloneFastaData2CreateDB = event.target.value.trim();
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
