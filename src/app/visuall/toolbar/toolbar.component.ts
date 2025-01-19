import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Subscription } from "rxjs";
import {
  getPropNamesFromObject,
  MIN_MESSAGE_DURATION,
  SAMPLE_DATABASES,
} from "../constants";
import { CytoscapeService } from "../cytoscape.service";
import { GlobalVariableService } from "../global-variable.service";
import { AboutModalComponent } from "../popups/about-modal/about-modal.component";
import { QuickHelpModalComponent } from "../popups/quick-help-modal/quick-help-modal.component";
import { SaveAsPngModalComponent } from "../popups/save-as-png-modal/save-as-png-modal.component";
import { ToolbarAction, ToolbarDiv } from "./toolbar";

@Component({
  selector: "app-toolbar",
  templateUrl: "./toolbar.component.html",
  styleUrls: ["./toolbar.component.css"],
})
export class ToolbarComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("file", { static: false }) file;
  searchTxt: string;
  sampleDatabases: string[] = SAMPLE_DATABASES;
  selectedSampleDatabase: string = this._g.selectedSampleDatabase.getValue();
  menu: ToolbarDiv[];
  statusMessage = "";
  statusMessageQueue: string[] = [];
  statusMessageSubscription: Subscription;
  userPreferenceSubscription: Subscription;
  selectedSampleDatabaseSubscription: Subscription;
  messageStarted2Show: number = 0;
  isLimitDbQueries2range: boolean;
  @ViewChild("dbQueryDate1", { static: false }) dbQueryDate1: ElementRef;
  @ViewChild("dbQueryDate2", { static: false }) dbQueryDate2: ElementRef;

  constructor(
    private _cyService: CytoscapeService,
    private modalService: NgbModal,
    private _g: GlobalVariableService
  ) {
    this.menu = [
      {
        div: 0,
        items: [
          {
            imgSrc: "assets/img/toolbar/load.svg",
            title: "Load",
            fn: "load",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/save.svg",
            title: "Save",
            fn: "saveAsJson",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/png.svg",
            title: "Save as PNG",
            fn: "saveAsPng",
            isRegular: true,
          },
        ],
      },
      {
        div: 1,
        items: [
          {
            imgSrc: "assets/img/toolbar/delete-simple.svg",
            title: "Delete Selected",
            fn: "deleteSelected",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/history.svg",
            title: "Query History",
            fn: "showHideGraphHistory",
            isRegular: true,
          },
        ],
      },
      {
        div: 2,
        items: [
          {
            imgSrc: "assets/img/toolbar/hide-selected.svg",
            title: "Hide Selected",
            fn: "hideSelected",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/show-all.svg",
            title: "Show All",
            fn: "showAll",
            isRegular: true,
          },
        ],
      },
      {
        div: 3,
        items: [
          {
            imgSrc: "assets/img/toolbar/search.svg",
            title: "Search to Highlight",
            fn: "highlightSearch",
            isRegular: true,
          },
          {
            imgSrc: "",
            title: "Search",
            fn: "",
            isRegular: false,
          },
          {
            imgSrc: "assets/img/toolbar/highlight-selected.svg",
            title: "Highlight Selected",
            fn: "highlightSelected",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/remove-highlights.svg",
            title: "Remove Highlights",
            fn: "removeHighlights",
            isRegular: true,
          },
        ],
      },
      {
        div: 4,
        items: [
          {
            imgSrc: "assets/img/toolbar/layout-cose.svg",
            title: "Perform Layout",
            fn: "performLayout",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/layout-static.svg",
            title: "Recalculate Layout",
            fn: "reLayout",
            isRegular: true,
          },
        ],
      },
      {
        div: 5,
        items: [
          {
            imgSrc: "assets/img/toolbar/quick-help.svg",
            title: "Quick Help",
            fn: "openQuickHelp",
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/about.svg",
            title: "About",
            fn: "openAbout",
            isRegular: true,
          },
        ],
      },
      {
        div: 6,
        items: [
          {
            imgSrc: "",
            title: "Sample",
            fn: "",
            isRegular: false,
          },
        ],
      },
    ];
  }

  ngOnDestroy(): void {
    if (this.statusMessageSubscription) {
      this.statusMessageSubscription.unsubscribe();
    }
    if (this.userPreferenceSubscription) {
      this.userPreferenceSubscription.unsubscribe();
    }
    if (this.selectedSampleDatabaseSubscription) {
      this.selectedSampleDatabaseSubscription.unsubscribe();
    }
  }

  ngOnInit() {
    this.statusMessageSubscription = this._g.statusMessage.subscribe((x) => {
      this.statusMessageQueue.push(x);
      this.processMsgQueue();
    });
    this.userPreferenceSubscription = this._g.isUserPrefReady.subscribe((x) => {
      if (!x) {
        return;
      }
      // user preferences from local storage should be set
      // Better way might be to use a shared behavior subject just like `isUserPrefReady`. Its name might be isUserPrefFromLocalStorageReady
    });
    this.selectedSampleDatabaseSubscription =
      this._g.selectedSampleDatabase.subscribe(() => {
        this.selectedSampleDatabase = this._g.selectedSampleDatabase.getValue();
      });
  }

  private processMsgQueue() {
    if (this.statusMessageQueue.length < 1) {
      this.statusMessage = "";
      return;
    }
    const currTime = new Date().getTime();
    const timePassed = currTime - this.messageStarted2Show;
    if (timePassed >= MIN_MESSAGE_DURATION || this.statusMessage.length === 0) {
      this.statusMessage = this.statusMessageQueue[0];
      this.messageStarted2Show = currTime;
      this.statusMessageQueue.shift();
    } else {
      // enough time didn't passed yet. Check again when it is passed.
      setTimeout(
        this.processMsgQueue.bind(this),
        MIN_MESSAGE_DURATION - timePassed
      );
    }
  }

  ngAfterViewInit() {
    // angular rendering harms previous manual positioning
    this._cyService.setNavigatorPosition();
  }

  fileSelected() {
    this._cyService.loadFile(this.file.nativeElement.files[0]);
  }

  triggerAct(act: ToolbarAction) {
    this[act.fn]();
  }

  load() {
    this.file.nativeElement.value = "";
    this.file.nativeElement.click();
  }

  saveAsJson() {
    this._cyService.saveAsJson();
  }

  saveAsPng() {
    this.modalService.open(SaveAsPngModalComponent);
  }

  deleteSelected() {
    this._cyService.deleteSelected(null);
  }

  hideSelected() {
    this._cyService.showHideSelectedElements(true);
  }

  showAll() {
    this._cyService.showHideSelectedElements(false);
  }

  highlightSearch() {
    const filterFn = (x: any) => {
      const entityMap = this._g.dataModel.getValue();
      const propertyNames = getPropNamesFromObject(
        [entityMap.nodes, entityMap.edges],
        false
      );
      const isIgnoreCase =
        this._g.userPreferences.isIgnoreCaseInText.getValue();
      let s = "";
      for (const propertyName of propertyNames) {
        const value = x.data(propertyName);
        if (value != undefined && value != null) {
          s += value;
        }
      }
      if (isIgnoreCase) {
        return s.toLowerCase().includes(this.searchTxt.toLowerCase());
      }
      return s.includes(this.searchTxt);
    };
    let satisfyingElements = this._g.cy.filter(filterFn);
    satisfyingElements = satisfyingElements.union(
      this._g.filterRemovedElements(filterFn)
    );
    this._g.highlightElements(satisfyingElements);
  }

  highlightSelected() {
    this._cyService.highlightSelected();
  }

  removeHighlights() {
    this._cyService.removeHighlights();
  }

  performLayout() {
    this._g.performLayout(false, true);
  }

  reLayout() {
    this._g.performLayout(true);
  }

  openQuickHelp() {
    this.modalService.open(QuickHelpModalComponent);
  }

  openAbout() {
    this.modalService.open(AboutModalComponent);
  }

  showHideGraphHistory() {
    const v = this._g.showHideGraphHistory.getValue();
    this._g.showHideGraphHistory.next(!v);
  }

  setSampleDatabase() {
    this._g.setSampleDatabase(this.selectedSampleDatabase);
  }
}
