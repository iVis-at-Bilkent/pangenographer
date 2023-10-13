import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from "@angular/core";
import { CytoscapeService } from "../cytoscape.service";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { SaveAsPngModalComponent } from "../popups/save-as-png-modal/save-as-png-modal.component";
import { AboutModalComponent } from "../popups/about-modal/about-modal.component";
import { QuickHelpModalComponent } from "../popups/quick-help-modal/quick-help-modal.component";
import { GlobalVariableService } from "../global-variable.service";
import { getPropNamesFromObj } from "../constants";
import { ToolbarCustomizationService } from "../../custom/toolbar-customization.service";
import { ToolbarDiv, ToolbarAction } from "./itoolbar";
import { Subscription } from "rxjs";
import { UserProfileService } from "../user-profile.service";
import flatpickr from "flatpickr";

@Component({
  selector: "app-toolbar",
  templateUrl: "./toolbar.component.html",
  styleUrls: ["./toolbar.component.css"],
})
export class ToolbarComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("file", { static: false }) file;
  searchTxt: string;
  menu: ToolbarDiv[];
  statusMsg = "";
  statusMsgQueue: string[] = [];
  MIN_MSG_DURATION = 500;
  statusMsgSubs: Subscription;
  userPrefSubs: Subscription;
  msgStarted2show: number = 0;
  isLimitDbQueries2range: boolean;
  @ViewChild("dbQueryDate1", { static: false }) dbQueryDate1: ElementRef;
  @ViewChild("dbQueryDate2", { static: false }) dbQueryDate2: ElementRef;

  constructor(
    private _cyService: CytoscapeService,
    private modalService: NgbModal,
    private _g: GlobalVariableService,
    private _customizationService: ToolbarCustomizationService,
    private _profile: UserProfileService
  ) {
    this.menu = [
      {
        div: 0,
        items: [
          {
            imgSrc: "assets/img/toolbar/load.svg",
            title: "Load",
            fn: "load",
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/save.svg",
            title: "Save",
            fn: "saveAsJson",
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/png.svg",
            title: "Save as PNG",
            fn: "saveAsPng",
            isStd: true,
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
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/history.svg",
            title: "Query History",
            fn: "showHideGraphHistory",
            isStd: true,
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
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/show-all.svg",
            title: "Show All",
            fn: "showAll",
            isStd: true,
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
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "",
            title: "must be hard coded to HTML",
            fn: "",
            isStd: true,
            isRegular: false,
          },
          {
            imgSrc: "assets/img/toolbar/highlight-selected.svg",
            title: "Highlight Selected",
            fn: "highlightSelected",
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/remove-highlights.svg",
            title: "Remove Highlights",
            fn: "removeHighlights",
            isStd: true,
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
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/layout-static.svg",
            title: "Recalculate Layout",
            fn: "reLayout",
            isStd: true,
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
            isStd: true,
            isRegular: true,
          },
          {
            imgSrc: "assets/img/toolbar/about.svg",
            title: "About",
            fn: "openAbout",
            isStd: true,
            isRegular: true,
          },
        ],
      },
    ];
  }

  ngOnDestroy(): void {
    if (this.statusMsgSubs) {
      this.statusMsgSubs.unsubscribe();
    }
    if (this.userPrefSubs) {
      this.userPrefSubs.unsubscribe();
    }
  }

  ngOnInit() {
    this.mergeCustomMenu();
    this.statusMsgSubs = this._g.statusMsg.subscribe((x) => {
      this.statusMsgQueue.push(x);
      this.processMsgQueue();
    });
    this.userPrefSubs = this._g.isUserPrefReady.subscribe((x) => {
      if (!x) {
        return;
      }
      // user preferences from local storage should be setted
      // Better way might be to use a shared behaviour subject just like `isUserPrefReady`. Its name might be isUserPrefFromLocalStorageReady
      setTimeout(() => {
        this.setDates4DbQuery();
      }, 1);
    });
  }

  private processMsgQueue() {
    if (this.statusMsgQueue.length < 1) {
      this.statusMsg = "";
      return;
    }
    const currTime = new Date().getTime();
    const timePassed = currTime - this.msgStarted2show;
    if (timePassed >= this.MIN_MSG_DURATION || this.statusMsg.length === 0) {
      this.statusMsg = this.statusMsgQueue[0];
      this.msgStarted2show = currTime;
      this.statusMsgQueue.shift();
    } else {
      // enough time didn't passed yet. Check again when it is passed.
      setTimeout(
        this.processMsgQueue.bind(this),
        this.MIN_MSG_DURATION - timePassed
      );
    }
  }

  ngAfterViewInit() {
    // angular rendering harms previous manual positioning
    this._cyService.setNavigatorPosition();
  }

  mergeCustomMenu() {
    const m = this._customizationService.menu;
    // in any case, set isStd property to false
    m.map((x) => x.items.map((y) => (y.isStd = false)));

    for (const i of m) {
      const idx = this.menu.findIndex((x) => x.div === i.div);
      if (idx === -1) {
        this.menu.push(i);
      } else {
        this.menu[idx].items.push(...i.items);
      }
    }
  }

  fileSelected() {
    this._cyService.loadFile(this.file.nativeElement.files[0]);
  }

  triggerAct(act: ToolbarAction) {
    if (act.isStd) {
      this[act.fn]();
    } else {
      this._customizationService[act.fn]();
    }
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
    const filterFn = (x) => {
      const entityMap = this._g.dataModel.getValue();
      const propNames = getPropNamesFromObj(
        [entityMap.nodes, entityMap.edges],
        false
      );
      const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
      let s = "";
      for (const propName of propNames) {
        const val = x.data(propName);
        if (val != undefined && val != null) {
          s += val;
        }
      }
      if (isIgnoreCase) {
        return s.toLowerCase().includes(this.searchTxt.toLowerCase());
      }
      return s.includes(this.searchTxt);
    };
    let satisfyingElems = this._g.cy.filter(filterFn);
    satisfyingElems = satisfyingElems.union(
      this._g.filterRemovedElems(filterFn)
    );
    this._g.highlightElements(satisfyingElems);
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

  changeIsLimitDbQueryRange() {
    this._g.userPrefs.isLimitDbQueries2range.next(this.isLimitDbQueries2range);
    this._profile.saveUserPrefs();
  }

  resetDbQueryRange() {
    if (!this.isLimitDbQueries2range) {
      return;
    }
    const minDate =
      this._g.userPrefsFromFiles.dbQueryTimeRange.start.getValue();
    const maxDate = this._g.userPrefsFromFiles.dbQueryTimeRange.end.getValue();
    this.dbQueryDate1.nativeElement._flatpickr.setDate(minDate);
    this.dbQueryDate2.nativeElement._flatpickr.setDate(maxDate);
    this._g.userPrefs.dbQueryTimeRange.start.next(minDate);
    this._g.userPrefs.dbQueryTimeRange.end.next(maxDate);
    this._profile.saveUserPrefs();
  }

  private setDates4DbQuery() {
    const maxDate = this._g.userPrefsFromFiles.dbQueryTimeRange.end.getValue();
    const minDate =
      this._g.userPrefsFromFiles.dbQueryTimeRange.start.getValue();
    const d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    const opt1 = {
      defaultDate: new Date(d1),
      enableTime: true,
      enableSeconds: true,
      time_24hr: true,
      onChange: (x, _, instance) => {
        const dateTime = x[0].getTime();
        const startDate = this._g.userPrefs.dbQueryTimeRange.start.getValue();
        const endDate = this._g.userPrefs.dbQueryTimeRange.end.getValue();
        if (dateTime >= endDate) {
          instance.setDate(startDate);
          this.showDateTimeError(
            "Start datetime should be earlier than end datetime"
          );
          return;
        }
        this._g.userPrefs.dbQueryTimeRange.start.next(dateTime);
        this._profile.saveUserPrefs();
      },
      minDate: minDate,
      maxDate: maxDate,
    };
    const d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    const opt2 = {
      defaultDate: new Date(d2),
      enableTime: true,
      enableSeconds: true,
      time_24hr: true,
      onChange: (x, _, instance) => {
        const dateTime = x[0].getTime();
        const startDate = this._g.userPrefs.dbQueryTimeRange.start.getValue();
        const endDate = this._g.userPrefs.dbQueryTimeRange.end.getValue();
        if (dateTime <= startDate) {
          instance.setDate(endDate);
          this.showDateTimeError(
            "End datetime should be later than start datetime"
          );
          return;
        }
        this._g.userPrefs.dbQueryTimeRange.end.next(dateTime);
        this._profile.saveUserPrefs();
      },
      minDate: minDate,
      maxDate: maxDate,
    };
    flatpickr(this.dbQueryDate1.nativeElement, opt1);
    flatpickr(this.dbQueryDate2.nativeElement, opt2);
    this.isLimitDbQueries2range =
      this._g.userPrefs.isLimitDbQueries2range.getValue();
  }

  private showDateTimeError(msg: string) {
    this._g.showErrorModal("Date Selection", msg);
  }
}
