import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Subscription } from "rxjs";
import {
  sample_1,
  sample_2,
  sample_3,
  sample_4,
  sample_5,
  sample_6,
  sample_7,
} from "../../../../sample_gfas/sample_gfas";
import { CLUSTER_CLASS, SAMPLE_DATABASES } from "../constants";
import { CytoscapeService } from "../cytoscape.service";
import { GFAData } from "../db-service/data-types";
import { DbAdapterService } from "../db-service/db-adapter.service";
import { FileReaderService } from "../file-reader.service";
import { GlobalVariableService } from "../global-variable.service";
import { URLLoadService } from "../load-from-url.service";
import { AboutModalComponent } from "../popups/about-modal/about-modal.component";
import { ClearDatabaseModalComponent } from "../popups/clear-database-modal/clear-database-modal.component";
import { LegendModalComponent } from "../popups/legend-modal/legend-modal.component";
import { QuickHelpModalComponent } from "../popups/quick-help-modal/quick-help-modal.component";
import { SaveAsPngModalComponent } from "../popups/save-as-png-modal/save-as-png-modal.component";
import { SaveProfileModalComponent } from "../popups/save-profile-modal/save-profile-modal.component";
import { GroupingOptionTypes } from "../user-preference";
import { UserProfileService } from "../user-profile.service";
import { NavbarAction, NavbarDropdown } from "./inavbar";

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.css"],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild("file", { static: false }) file;

  menu: NavbarDropdown[];
  closeResult: string;
  toolName: string;
  toolLogo: string;
  isLoadFile4Graph: boolean = false;
  isLoadFileGFA: boolean = false;
  appDescSubscription: Subscription;

  constructor(
    private _dbService: DbAdapterService,
    private _cyService: CytoscapeService,
    private _modalService: NgbModal,
    private _g: GlobalVariableService,
    private _profile: UserProfileService,
    private _urlload: URLLoadService,
    private _fileReaderService: FileReaderService
  ) {
    this.menu = [
      {
        dropdown: "File",
        actions: [
          { text: "Load...", id: "nbi00", function: "loadFile" },
          { text: "Save", id: "nbi01", function: "saveAsJson" },
          {
            text: "Save Selected Objects",
            id: "nbi02",
            function: "saveSelectedAsJson",
          },
          {
            text: "Samples",
            id: "nbi07",
            actions: [
              {
                text: "Sample 1",
                id: "nbi07-0",
                function: "sampleGFASelected",
                parameters: sample_1,
              },
              {
                text: "Sample 2",
                id: "nbi07-1",
                function: "sampleGFASelected",
                parameters: sample_2,
              },
              {
                text: "Sample 3",
                id: "nbi07-2",
                function: "sampleGFASelected",
                parameters: sample_3,
              },
              {
                text: "Sample 4",
                id: "nbi07-3",
                function: "sampleGFASelected",
                parameters: sample_4,
              },
              {
                text: "Sample 5",
                id: "nbi07-4",
                function: "sampleGFASelected",
                parameters: sample_5,
              },
              {
                text: "Sample 6",
                id: "nbi07-5",
                function: "sampleGFASelected",
                parameters: sample_6,
              },
              {
                text: "Sample 7",
                id: "nbi07-6",
                function: "sampleGFASelected",
                parameters: sample_7,
              },
              {
                text: SAMPLE_DATABASES[1],
                id: SAMPLE_DATABASES[1],
                function: "setSampleDatabase",
                parameters: SAMPLE_DATABASES[1],
              },
              {
                text: SAMPLE_DATABASES[2],
                id: SAMPLE_DATABASES[2],
                function: "setSampleDatabase",
                parameters: SAMPLE_DATABASES[2],
              },
              {
                text: SAMPLE_DATABASES[3],
                id: SAMPLE_DATABASES[3],
                function: "setSampleDatabase",
                parameters: SAMPLE_DATABASES[3],
              },
              {
                text: SAMPLE_DATABASES[4],
                id: SAMPLE_DATABASES[4],
                function: "setSampleDatabase",
                parameters: SAMPLE_DATABASES[4],
              },
              {
                text: SAMPLE_DATABASES[5],
                id: SAMPLE_DATABASES[5],
                function: "setSampleDatabase",
                parameters: SAMPLE_DATABASES[5],
              },
            ],
          },
          {
            text: "Import GFA..",
            id: "nbi04",
            function: "loadGFAFile2Db",
          },
          { text: "Save as PNG...", id: "nbi03", function: "saveAsPng" },
          {
            text: "Load User Profile...",
            id: "nbi05",
            function: "loadUserProfile",
          },
          {
            text: "Save User Profile...",
            id: "nbi06",
            function: "saveUserProfile",
          },
        ],
      },
      {
        dropdown: "Edit",
        actions: [
          {
            text: "Add Group for Selected",
            id: "nbi10",
            function: "addGroup4Selected",
          },
          {
            text: "Remove Group for Selected",
            id: "nbi11",
            function: "removeGroup4Selected",
          },
          {
            text: "Remove All Groups",
            id: "nbi12",
            function: "removeAllGroups",
          },
          {
            text: "Delete Selected",
            id: "nbi13",
            function: "deleteSelected",
          },
          {
            text: "Query History",
            id: "nbi101",
            function: "showHideGraphHistory",
          },
        ],
      },
      {
        dropdown: "View",
        actions: [
          {
            text: "Hide Selected",
            id: "nbi20",
            function: "hideSelected",
          },
          {
            text: "Hide Unselected",
            id: "nbi21",
            function: "hideUnselected",
          },
          { text: "Show All", id: "nbi22", function: "showAll" },
          {
            text: "Collapse All Nodes",
            id: "nbi23",
            function: "collapseAllNodes",
          },
          {
            text: "Expand All Nodes",
            id: "nbi24",
            function: "expandAllNodes",
          },
          {
            text: "Collapse All Edges",
            id: "nbi25",
            function: "collapseAllEdges",
          },
          {
            text: "Expand All Edges",
            id: "nbi26",
            function: "expandAllEdges",
          },
        ],
      },
      {
        dropdown: "Highlight",
        actions: [
          {
            text: "Search...",
            id: "nbi30",
            function: "search2Highlight",
          },
          {
            text: "Selected",
            id: "nbi31",
            function: "highlightSelected",
          },
          {
            text: "Neighbors of Selected",
            id: "nbi32",
            function: "highlightNeighborsOfSelected",
          },
          {
            text: "Remove Highlights",
            id: "nbi33",
            function: "removeHighlights",
          },
        ],
      },
      {
        dropdown: "Layout",
        actions: [
          { text: "Perform Layout", id: "nbi40", function: "doLayout" },
          {
            text: "Recalculate Layout",
            id: "nbi41",
            function: "recalculateLayout",
          },
        ],
      },
      {
        dropdown: "Help",
        actions: [
          { text: "Quick Help", id: "nbi50", function: "openQuickHelp" },
          { text: "Legend", id: "nbi52", function: "openLegend" },
          { text: "About", id: "nbi51", function: "openAbout" },
        ],
      },
      {
        dropdown: "Data",
        actions: [
          {
            text: "Get Some Zero Degree Nodes",
            id: "nbi60",
            function: "getSomeZeroDegreeNodes",
          },
          {
            text: "Get All Zero Degree Nodes",
            id: "nbi61",
            function: "getAllZeroDegreeNodes",
          },
          {
            text: "Get All Zero Incoming Degree Nodes",
            id: "nbi62",
            function: "getAllZeroIncomingDegreeNodes",
          },
          {
            text: "Get All Zero Outgoing Degree Nodes",
            id: "nbi63",
            function: "getAllZeroOutgoingDegreeNodes",
          },
          { text: "Sample Data", id: "nbi64", function: "getSampleData" },
          { text: "Clear Data", id: "nbi65", function: "clearDatabase" },
        ],
      },
    ];
  }

  ngOnInit() {
    this.appDescSubscription = this._g.appDescription.subscribe((x) => {
      if (x != null) {
        this.toolName = x.appInfo.name;
        this.toolLogo = x.appInfo.icon;
      }
    });
    this._urlload.init();
  }

  ngOnDestroy() {
    if (this.appDescSubscription) {
      this.appDescSubscription.unsubscribe();
    }
  }

  triggerAct(action: NavbarAction) {
    if (action.parameters) {
      this[action.function](action.parameters);
    } else {
      this[action.function]();
    }
  }

  preventDropdownClose(event: Event) {
    event.stopPropagation();
  }

  // Load file selected by the user from the file input element
  // If the file is a GFA file, read the GFA file and import the GFA data to the database
  // If the file is a JSON file, load the JSON file
  // If the file is a text file, read the text file and set the user profile
  fileSelected() {
    if (this.isLoadFileGFA) {
      this._cyService.readGFAFile(
        this.file.nativeElement.files[0],
        (GFAData: GFAData) => {
          // Import GFA data to the database and return a promise
          return this._dbService.getGFAData2ImportGFAPromised(GFAData);
        }
      );
    } else if (this.isLoadFile4Graph) {
      this._cyService.loadFile(this.file.nativeElement.files[0]);
    } else {
      this._fileReaderService.readTxtFile(
        this.file.nativeElement.files[0],
        (s) => {
          this._profile.setUserProfile(s);
        }
      );
    }
  }

  // Triggered when the user selects a sample from the samples dropdown
  sampleGFASelected(sample: string) {
    // If the user selects a sample, open the clear database modal
    this._g.setSampleDatabase(SAMPLE_DATABASES[0]);
    this._modalService
      // Open the clear database modal to certify that the user wants to clear the database
      .open(ClearDatabaseModalComponent)
      .result.then(
        () => {}, // Execute nothing when the modal is closed
        (reason) => {
          // Execute the callback function when the modal is dismissed

          // Prepare the GFA load, set the isLoadFile4Graph and isLoadFileGFA flags to true
          this.prepareGFALoad();

          // Read the GFA sample name and itself then import the GFA data to the database
          this._cyService.readGFASample(sample, (GFAData: GFAData) => {
            // Import GFA data to the database and return a promise
            return this._dbService.getGFAData2ImportGFAPromised(GFAData);
          });
        }
      );
  }

  setSampleDatabase(sampleDatabase: string) {
    this._g.setSampleDatabase(sampleDatabase);
  }

  // Load file selected by the user from the file input element
  loadFile() {
    // Open the clear database modal to certify that the user wants to clear the database
    this._modalService.open(ClearDatabaseModalComponent).result.then(
      () => {}, // Execute nothing when the modal is closed
      (reason) => {
        // Execute the callback function when the modal is dismissed
        this.isLoadFile4Graph = true; // Set the isLoadFile4Graph flag to true
        this.isLoadFileGFA = false; // Set the isLoadFileGFA flag to false
        this.openFileInput(); // Open the file input to allow the user to select a file
      }
    );
  }

  // Triggered when the user selects the "Import GFA" option from the file dropdown
  loadGFAFile2Db() {
    this._modalService
      // Open the clear database modal to certify that the user wants to clear the database
      .open(ClearDatabaseModalComponent)
      .result.then(
        () => {}, // Execute nothing when the modal is closed
        (reason) => {
          // Execute the callback function when the modal is dismissed

          // Prepare the GFA load and set the isLoadFile4Graph and isLoadFileGFA flags to true
          this.prepareGFALoad();

          // Open the file input to allow the user to select a file
          this.openFileInput();
        }
      );
  }

  prepareGFALoad() {
    this.isLoadFile4Graph = true;
    this.isLoadFileGFA = true;
  }

  loadUserProfile() {
    this.isLoadFile4Graph = false;
    this.isLoadFileGFA = false;
    this.openFileInput();
  }

  saveAsJson() {
    this._cyService.saveAsJson();
  }

  saveSelectedAsJson() {
    this._cyService.saveSelectedAsJson();
  }

  saveAsPng() {
    this._modalService.open(SaveAsPngModalComponent);
  }

  saveUserProfile() {
    this._modalService.open(SaveProfileModalComponent, { size: "sm" });
  }

  deleteSelected() {
    this._cyService.deleteSelected(null);
  }

  addGroup4Selected() {
    this._cyService.addGroup4Selected();
  }

  removeGroup4Selected() {
    this._cyService.removeGroup4Selected();
  }

  removeAllGroups() {
    if (
      this._g.userPreferences.groupingOption.getValue() ==
      GroupingOptionTypes.compound
    ) {
      this._cyService.removeGroup4Selected(
        this._g.cy.nodes("." + CLUSTER_CLASS)
      );
    } else {
      this._cyService.removeGroup4Selected(this._g.cy.nodes());
    }
  }

  hideSelected() {
    this._cyService.showHideSelectedElements(true);
  }

  hideUnselected() {
    this._cyService.hideUnselected();
  }

  showAll() {
    this._cyService.showHideSelectedElements(false);
  }

  search2Highlight() {
    document.getElementById("highlight-search-input").focus();
  }

  highlightSelected() {
    this._cyService.highlightSelected();
  }

  highlightNeighborsOfSelected() {
    this._cyService.staticHighlightNeighbors();
  }

  removeHighlights() {
    this._cyService.removeHighlights();
  }

  doLayout() {
    this._g.performLayout(false, true);
  }

  recalculateLayout() {
    this._g.performLayout(true);
  }

  openQuickHelp() {
    this._modalService.open(QuickHelpModalComponent);
  }

  openAbout() {
    this._modalService.open(AboutModalComponent);
  }

  openLegend() {
    this._modalService.open(LegendModalComponent, { size: "lg" });
  }

  collapseAllEdges() {
    this._cyService.collapseMultiEdges();
  }

  expandAllEdges() {
    this._cyService.expandMultiEdges();
  }

  collapseAllNodes() {
    this._cyService.collapseNodes();
  }

  expandAllNodes() {
    this._cyService.expandAllCompounds();
  }

  showHideGraphHistory() {
    const v = this._g.showHideGraphHistory.getValue();
    this._g.showHideGraphHistory.next(!v);
  }

  // Get some nodes with zero degree
  // Uses cytoscape service to get some nodes with zero degree
  getSomeZeroDegreeNodes() {
    this._cyService.getSomeZeroDegreeNodes();
    this._g.statusMessage.next("Getting some nodes with zero degree");
  }

  // Get all nodes with zero degree
  // Uses cytoscape service to get all nodes with zero degree
  getAllZeroDegreeNodes() {
    this._cyService.getAllZeroDegreeNodes();
    this._g.statusMessage.next("Getting all nodes with zero degree");
  }

  // Get all nodes with zero incoming degree
  // Uses cytoscape service to get all nodes with zero incoming degree
  getAllZeroIncomingDegreeNodes() {
    this._cyService.getAllZeroIncomingDegreeNodes();
    this._g.statusMessage.next("Getting all nodes with zero incoming degree");
  }

  // Get all nodes with zero outgoing degree
  // Uses cytoscape service to get all nodes with zero outgoing degree
  getAllZeroOutgoingDegreeNodes() {
    this._cyService.getAllZeroOutgoingDegreeNodes();
    this._g.statusMessage.next("Getting all nodes with zero outgoing degree");
  }

  // Get all nodes with zero degree
  // Sets the layout clusters to null to remove the clusters from the graph
  // Uses the database service to get all nodes with zero degree
  // Gives the callback function to the database service to get the data in the form of a graph response,
  // cytoscape service is used to load the elements from the database
  getSampleData() {
    this._g.layout.clusters = null;
    this._g.statusMessage.next("Getting sample data");
    this._dbService.getSampleData((x) => {
      this._cyService.loadElementsFromDatabase(x, false);
    });
  }

  // Clear database and cytoscape graph
  // Remove external tools, clear graph history, and remove all elements from cytoscape graph
  clearDatabase() {
    this._modalService.open(ClearDatabaseModalComponent);
  }

  private openFileInput() {
    this.file.nativeElement.value = "";
    this.file.nativeElement.click();
  }
}
