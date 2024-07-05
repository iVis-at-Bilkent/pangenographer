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
import { CLUSTER_CLASS } from "../constants";
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
          { txt: "Load...", id: "nbi00", fn: "loadFile" },
          { txt: "Save", id: "nbi01", fn: "saveAsJson" },
          {
            txt: "Save Selected Objects",
            id: "nbi02",
            fn: "saveSelectedAsJson",
          },
          {
            txt: "Samples",
            id: "nbi07",
            actions: [
              {
                txt: "Sample 1",
                id: "nbi07-0",
                fn: "loadSampleGFAFile1",
              },
              {
                txt: "Sample 2",
                id: "nbi07-1",
                fn: "loadSampleGFAFile2",
              },
              {
                txt: "Sample 3",
                id: "nbi07-2",
                fn: "loadSampleGFAFile3",
              },
              {
                txt: "Sample 4",
                id: "nbi07-3",
                fn: "loadSampleGFAFile4",
              },
              {
                txt: "Sample 5",
                id: "nbi07-4",
                fn: "loadSampleGFAFile5",
              },
              {
                txt: "Sample 6",
                id: "nbi07-5",
                fn: "loadSampleGFAFile6",
              },
              {
                txt: "Sample 7",
                id: "nbi07-6",
                fn: "loadSampleGFAFile7",
              },
            ],
          },
          {
            txt: "Import GFA..",
            id: "nbi04",
            fn: "loadGFAFile2Db",
          },
          { txt: "Save as PNG...", id: "nbi03", fn: "saveAsPng" },
          {
            txt: "Load User Profile...",
            id: "nbi05",
            fn: "loadUserProfile",
          },
          {
            txt: "Save User Profile...",
            id: "nbi06",
            fn: "saveUserProfile",
          },
        ],
      },
      {
        dropdown: "Edit",
        actions: [
          {
            txt: "Add Group for Selected",
            id: "nbi10",
            fn: "addGroup4Selected",
          },
          {
            txt: "Remove Group for Selected",
            id: "nbi11",
            fn: "removeGroup4Selected",
          },
          {
            txt: "Remove All Groups",
            id: "nbi12",
            fn: "removeAllGroups",
          },
          {
            txt: "Delete Selected",
            id: "nbi13",
            fn: "deleteSelected",
          },
          {
            txt: "Query History",
            id: "nbi101",
            fn: "showHideGraphHistory",
          },
        ],
      },
      {
        dropdown: "View",
        actions: [
          {
            txt: "Hide Selected",
            id: "nbi20",
            fn: "hideSelected",
          },
          {
            txt: "Hide Unselected",
            id: "nbi21",
            fn: "hideUnselected",
          },
          { txt: "Show All", id: "nbi22", fn: "showAll" },
          {
            txt: "Collapse All Nodes",
            id: "nbi23",
            fn: "collapseAllNodes",
          },
          {
            txt: "Expand All Nodes",
            id: "nbi24",
            fn: "expandAllNodes",
          },
          {
            txt: "Collapse All Edges",
            id: "nbi25",
            fn: "collapseAllEdges",
          },
          {
            txt: "Expand All Edges",
            id: "nbi26",
            fn: "expandAllEdges",
          },
        ],
      },
      {
        dropdown: "Highlight",
        actions: [
          {
            txt: "Search...",
            id: "nbi30",
            fn: "search2Highlight",
          },
          {
            txt: "Selected",
            id: "nbi31",
            fn: "highlightSelected",
          },
          {
            txt: "Neighbors of Selected",
            id: "nbi32",
            fn: "highlightNeighborsOfSelected",
          },
          {
            txt: "Remove Highlights",
            id: "nbi33",
            fn: "removeHighlights",
          },
        ],
      },
      {
        dropdown: "Layout",
        actions: [
          { txt: "Perform Layout", id: "nbi40", fn: "doLayout" },
          {
            txt: "Recalculate Layout",
            id: "nbi41",
            fn: "recalculateLayout",
          },
        ],
      },
      {
        dropdown: "Help",
        actions: [
          { txt: "Quick Help", id: "nbi50", fn: "openQuickHelp" },
          { txt: "Legend", id: "nbi52", fn: "openLegend" },
          { txt: "About", id: "nbi51", fn: "openAbout" },
        ],
      },
      {
        dropdown: "Data",
        actions: [
          {
            txt: "Get Some Zero Degree Nodes",
            id: "nbi60",
            fn: "getSomeZeroDegreeNodes",
          },
          {
            txt: "Get All Zero Degree Nodes",
            id: "nbi61",
            fn: "getAllZeroDegreeNodes",
          },
          {
            txt: "Get All Zero Incoming Degree Nodes",
            id: "nbi62",
            fn: "getAllZeroIncomingDegreeNodes",
          },
          {
            txt: "Get All Zero Outgoing Degree Nodes",
            id: "nbi63",
            fn: "getAllZeroOutgoingDegreeNodes",
          },
          { txt: "Sample Data", id: "nbi64", fn: "getSampleData" },
          { txt: "Clear Data", id: "nbi65", fn: "clearDatabase" },
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

  triggerAct(act: NavbarAction) {
    this[act.fn]();
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
          return this._dbService.getGFAData2ImportGFAPromised(GFAData); // Import GFA data to the database and return a promise
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
            return this._dbService.getGFAData2ImportGFAPromised(GFAData); // Import GFA data to the database and return a promise
          });
        }
      );
  }

  // Load sample GFA file 1
  loadSampleGFAFile1() {
    this.sampleGFASelected(sample_1);
  }

  // Load sample GFA file 2
  loadSampleGFAFile2() {
    this.sampleGFASelected(sample_2);
  }

  // Load sample GFA file 3
  loadSampleGFAFile3() {
    this.sampleGFASelected(sample_3);
  }

  // Load sample GFA file 4
  loadSampleGFAFile4() {
    this.sampleGFASelected(sample_4);
  }

  // Load sample GFA file 5
  loadSampleGFAFile5() {
    this.sampleGFASelected(sample_5);
  }

  // Load sample GFA file 6
  loadSampleGFAFile6() {
    this.sampleGFASelected(sample_6);
  }

  // Load sample GFA file 7
  loadSampleGFAFile7() {
    this.sampleGFASelected(sample_7);
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
  }

  // Get all nodes with zero degree
  // Uses cytoscape service to get all nodes with zero degree
  getAllZeroDegreeNodes() {
    this._cyService.getAllZeroDegreeNodes();
  }

  // Get all nodes with zero incoming degree
  // Uses cytoscape service to get all nodes with zero incoming degree
  getAllZeroIncomingDegreeNodes() {
    this._cyService.getAllZeroIncomingDegreeNodes();
  }

  // Get all nodes with zero outgoing degree
  // Uses cytoscape service to get all nodes with zero outgoing degree
  getAllZeroOutgoingDegreeNodes() {
    this._cyService.getAllZeroOutgoingDegreeNodes();
  }

  // Get all nodes with zero degree
  // Sets the layout clusters to null to remove the clusters from the graph
  // Uses the database service to get all nodes with zero degree
  // Gives the callback function to the database service to get the data in the form of a graph response,
  // cytoscape service is used to load the elements from the database
  getSampleData() {
    this._g.layout.clusters = null;
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
