import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { DbAdapterService } from "../db-service/db-adapter.service";
import { GlobalVariableService } from "../global-variable.service";
import { CytoscapeService } from "../cytoscape.service";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { SaveAsPngModalComponent } from "../popups/save-as-png-modal/save-as-png-modal.component";
import { AboutModalComponent } from "../popups/about-modal/about-modal.component";
import { QuickHelpModalComponent } from "../popups/quick-help-modal/quick-help-modal.component";
import { NavbarDropdown, NavbarAction } from "./inavbar";
import { UserProfileService } from "../user-profile.service";
import { CLUSTER_CLASS } from "../constants";
import { SaveProfileModalComponent } from "../popups/save-profile-modal/save-profile-modal.component";
import { URLLoadService } from "../load-from-url.service";
import { GroupingOptionTypes } from "../user-preference";
import { Subscription } from "rxjs";
import { FileReaderService } from "../file-reader.service";
import { GFAData } from "../db-service/data-types";
import samples from "../../../../sample_gfas/gfa.json";

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
  appDescSubs: Subscription;

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
                fn: "loadSampleFile1",
              },
              {
                txt: "Sample 2",
                id: "nbi07-1",
                fn: "loadSampleFile2",
              },
              {
                txt: "Sample 3",
                id: "nbi07-2",
                fn: "loadSampleFile3",
              },
              {
                txt: "Sample 4",
                id: "nbi07-3",
                fn: "loadSampleFile4",
              },
              {
                txt: "Sample 5",
                id: "nbi07-4",
                fn: "loadSampleFile5",
              },
              {
                txt: "Sample 6",
                id: "nbi07-5",
                fn: "loadSampleFile6",
              },
              {
                txt: "Sample 7",
                id: "nbi07-6",
                fn: "loadSampleFile7",
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
          { txt: "About", id: "nbi51", fn: "openAbout" },
        ],
      },
      {
        dropdown: "Data",
        actions: [
          { txt: "Sample Data", id: "nbi60", fn: "getSampleData" },
          { txt: "Clear Data", id: "nbi62", fn: "clearData" },
        ],
      },
    ];
  }

  ngOnInit() {
    this.appDescSubs = this._g.appDescription.subscribe((x) => {
      if (x != null) {
        this.toolName = x.appInfo.name;
        this.toolLogo = x.appInfo.icon;
      }
    });
    this._urlload.init();
  }

  ngOnDestroy() {
    if (this.appDescSubs) {
      this.appDescSubs.unsubscribe();
    }
  }

  fileSelected() {
    if (this.isLoadFileGFA) {
      this._cyService.readGFAFile(
        this.file.nativeElement.files[0],
        (GFAData: GFAData) => {
          this._dbService.getGFAdata2ImportGFA(GFAData, () => {
            this.getSampleData();
          });
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

  sampleSelected(sample: string) {
    this.prepareGFALoad();
    this._cyService.readGFASample(sample, (GFAData: GFAData) => {
      this._dbService.getGFAdata2ImportGFA(GFAData, () => {
        this.getSampleData();
      });
    });
  }

  triggerAct(act: NavbarAction) {
    this[act.fn]();
  }

  preventDropdownClose(event: Event) {
    event.stopPropagation();
  }

  prepareGFALoad() {
    this.clearData();
    this.isLoadFile4Graph = true;
    this.isLoadFileGFA = true;
  }

  loadSampleFile1() {
    this.sampleSelected(samples.sample_1_gfa_1);
  }

  loadSampleFile2() {
    this.sampleSelected(samples.sample_2_gfa_1);
  }

  loadSampleFile3() {
    this.sampleSelected(samples.sample_3_gfa_1);
  }

  loadSampleFile4() {
    this.sampleSelected(samples.sample_4_gfa_1);
  }

  loadSampleFile5() {
    this.sampleSelected(samples.sample_5_gfa_1);
  }

  loadSampleFile6() {
    this.sampleSelected(samples.sample_6_gfa_1);
  }

  loadSampleFile7() {
    this.sampleSelected(samples.sample_7_gfa_1);
  }

  loadFile() {
    this.clearData();
    this.isLoadFile4Graph = true;
    this.isLoadFileGFA = false;
    this.openFileInput();
  }

  loadGFAFile2Db() {
    this.prepareGFALoad();
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
      this._g.userPrefs.groupingOption.getValue() ==
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
    document.getElementById("highlight-search-inp").focus();
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

  getSampleData() {
    this._g.layout.clusters = null;
    this._dbService.getSampleData((x) => {
      this._cyService.loadElementsFromDatabase(x, false);
    });
  }

  clearData() {
    this._cyService.removeExternalTools();
    this._g.layout.clusters = null;
    this._g.cy.remove(this._g.cy.$());
    this._dbService.clearData();
  }

  showHideGraphHistory() {
    const v = this._g.showHideGraphHistory.getValue();
    this._g.showHideGraphHistory.next(!v);
  }

  loadUserProfile() {
    this.isLoadFile4Graph = false;
    this.isLoadFileGFA = false;
    this.openFileInput();
  }

  saveUserProfile() {
    this._modalService.open(SaveProfileModalComponent, { size: "sm" });
  }

  private openFileInput() {
    this.file.nativeElement.value = "";
    this.file.nativeElement.click();
  }
}
