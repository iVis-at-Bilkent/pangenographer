import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { DbAdapterService } from "../db-service/db-adapter.service";
import { GlobalVariableService } from "../global-variable.service";
import { CytoscapeService } from "../cytoscape.service";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { SaveAsPngModalComponent } from "../popups/save-as-png-modal/save-as-png-modal.component";
import { AboutModalComponent } from "../popups/about-modal/about-modal.component";
import { QuickHelpModalComponent } from "../popups/quick-help-modal/quick-help-modal.component";
import { NavbarCustomizationService } from "../../custom/navbar-customization.service";
import { NavbarDropdown, NavbarAction } from "./inavbar";
import { UserProfileService } from "../user-profile.service";
import { readTxtFile, CLUSTER_CLASS } from "../constants";
import { SaveProfileModalComponent } from "../popups/save-profile-modal/save-profile-modal.component";
import { URLLoadService } from "../load-from-url.service";
import { GroupingOptionTypes } from "../user-preference";
import { Subscription } from "rxjs";

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
    private _customizationService: NavbarCustomizationService,
    private _profile: UserProfileService,
    private _urlload: URLLoadService
  ) {
    this.menu = [
      {
        dropdown: "File",
        actions: [
          { txt: "Load...", id: "nbi00", fn: "loadFile", isStd: true },
          { txt: "Save", id: "nbi01", fn: "saveAsJson", isStd: true },
          {
            txt: "Save Selected Objects",
            id: "nbi02",
            fn: "saveSelectedAsJson",
            isStd: true,
          },
          { txt: "Save as PNG...", id: "nbi03", fn: "saveAsPng", isStd: true },
          {
            txt: "Load User Profile...",
            id: "nbi04",
            fn: "loadUserProfile",
            isStd: true,
          },
          {
            txt: "Save User Profile...",
            id: "nbi05",
            fn: "saveUserProfile",
            isStd: true,
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
            isStd: true,
          },
          {
            txt: "Remove Group for Selected",
            id: "nbi11",
            fn: "removeGroup4Selected",
            isStd: true,
          },
          {
            txt: "Remove All Groups",
            id: "nbi12",
            fn: "removeAllGroups",
            isStd: true,
          },
          {
            txt: "Delete Selected",
            id: "nbi13",
            fn: "deleteSelected",
            isStd: true,
          },
          {
            txt: "Query History",
            id: "nbi101",
            fn: "showHideGraphHistory",
            isStd: true,
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
            isStd: true,
          },
          {
            txt: "Hide Unselected",
            id: "nbi21",
            fn: "hideUnselected",
            isStd: true,
          },
          { txt: "Show All", id: "nbi22", fn: "showAll", isStd: true },
          {
            txt: "Collapse All Nodes",
            id: "nbi23",
            fn: "collapseAllNodes",
            isStd: true,
          },
          {
            txt: "Expand All Nodes",
            id: "nbi24",
            fn: "expandAllNodes",
            isStd: true,
          },
          {
            txt: "Collapse All Edges",
            id: "nbi25",
            fn: "collapseAllEdges",
            isStd: true,
          },
          {
            txt: "Expand All Edges",
            id: "nbi26",
            fn: "expandAllEdges",
            isStd: true,
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
            isStd: true,
          },
          {
            txt: "Selected",
            id: "nbi31",
            fn: "highlightSelected",
            isStd: true,
          },
          {
            txt: "Neighbors of Selected",
            id: "nbi32",
            fn: "highlightNeighborsOfSelected",
            isStd: true,
          },
          {
            txt: "Remove Highlights",
            id: "nbi33",
            fn: "removeHighlights",
            isStd: true,
          },
        ],
      },
      {
        dropdown: "Layout",
        actions: [
          { txt: "Perform Layout", id: "nbi40", fn: "doLayout", isStd: true },
          {
            txt: "Recalculate Layout",
            id: "nbi41",
            fn: "recalculateLayout",
            isStd: true,
          },
        ],
      },
      {
        dropdown: "Help",
        actions: [
          { txt: "Quick Help", id: "nbi50", fn: "openQuickHelp", isStd: true },
          { txt: "About", id: "nbi51", fn: "openAbout", isStd: true },
        ],
      },
      {
        dropdown: "Data",
        actions: [
          { txt: "Sample Data", id: "nbi60", fn: "getSampleData", isStd: true },
          { txt: "Clear Data", id: "nbi62", fn: "clearData", isStd: true },
          { txt: "Load GFA", id: "nbi63", fn: "loadGFAFile2Db", isStd: true },
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
    this.mergeCustomMenu();
    this._urlload.init();
  }

  ngOnDestroy(): void {
    if (this.appDescSubs) {
      this.appDescSubs.unsubscribe();
    }
  }

  mergeCustomMenu() {
    let m = this._customizationService.menu;
    // in any case, set isStd property to false
    m.map((x) => x.actions.map((y) => (y.isStd = false)));

    for (let i = 0; i < m.length; i++) {
      let idx = this.menu.findIndex((x) => x.dropdown == m[i].dropdown);
      if (idx == -1) {
        this.menu.push(m[i]);
      } else {
        this.menu[idx].actions.push(...m[i].actions);
      }
    }
  }

  fileSelected() {
    if (this.isLoadFileGFA) {
      this._cyService.readGFAFile(
        this.file.nativeElement.files[0],
        (GFAdata) => {
          this._dbService.getGFAdata2LoadGFA(GFAdata);
        }
      );
    } else if (this.isLoadFile4Graph) {
      this._cyService.loadFile(this.file.nativeElement.files[0]);
    } else {
      readTxtFile(this.file.nativeElement.files[0], (s) => {
        this._profile.setUserProfile(s);
      });
    }
  }

  triggerAct(act: NavbarAction) {
    if (act.isStd) {
      this[act.fn]();
    } else {
      this._customizationService[act.fn]();
    }
  }

  loadFile() {
    this.isLoadFile4Graph = true;
    this.isLoadFileGFA = false;
    this.openFileInput();
  }

  loadGFAFile2Db() {
    this.isLoadFile4Graph = true;
    this.isLoadFileGFA = true;
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
