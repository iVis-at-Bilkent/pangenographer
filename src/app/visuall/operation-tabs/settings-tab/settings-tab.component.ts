import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import {
  HIGHLIGHT_NAMES,
  MAX_HIGHTLIGHT_WIDTH,
  MAX_LENGTH_OF_UP_DOWN_STREAM,
  MIN_HIGHTLIGHT_WIDTH,
  MIN_LENGTH_OF_UP_DOWN_STREAM,
  getCyStyleFromColorAndWid,
} from "../../constants";
import { GlobalVariableService } from "../../global-variable.service";
import {
  BoolSetting,
  GroupingOptionTypes,
  MergedElemIndicatorTypes,
} from "../../user-preference";
import { UserProfileService } from "../../user-profile.service";

@Component({
  selector: "app-settings-tab",
  templateUrl: "./settings-tab.component.html",
  styleUrls: ["./settings-tab.component.css"],
})
export class SettingsTabComponent implements OnInit, OnDestroy {
  generalBoolSettings: BoolSetting[];
  pangenomegrapherBoolSettings: BoolSetting[];
  highlightWidth: number;
  highlightColor: string;
  compoundPadding: string;
  @ViewChild("dbQueryDate1", { static: false }) dbQueryDate1: ElementRef;
  @ViewChild("dbQueryDate2", { static: false }) dbQueryDate2: ElementRef;
  dataPageSize: number;
  dataPageLimit: number;
  queryHistoryLimit: number;
  dbTimeout: number;
  tableColumnLimit: number;
  edgeCollapseLimit: number;
  mergedElemIndicators: string[] = ["None", "Selection", "Highlight"];
  groupingOptions: string[] = ["Compounds", "Circles"];
  // multiple choice settings
  queryResultPagination: "Client" | "Server";
  mergedElemIndicator: MergedElemIndicatorTypes;
  groupingOption: GroupingOptionTypes;
  nodeLabelWrap: number = 0;
  isInit: boolean = false;
  currHighlightStyles: string[] = [];
  highlightStyleIdx = 0;
  isStoreUserProfile = true;
  selectionColor = "#6c757d";
  selectionWidth = 4.5;
  lengthOfUpDownstream: number = 3;
  loadFromFileSubs: Subscription;
  tabChangeSubs: Subscription;

  constructor(
    private _g: GlobalVariableService,
    private _profile: UserProfileService
  ) {
    this.loadFromFileSubs = this._profile.onLoadFromFile.subscribe((x) => {
      if (!x) {
        return;
      }
      this._profile.transferUserPrefs();
      this.setViewUtilsStyle();
      this.fillUIFromMemory();
    });
  }

  ngOnInit() {
    this.pangenomegrapherBoolSettings = [
      {
        text: "Highlight in/out-degree zero nodes",
        isEnable: true,
        path2userPref: "pangenomegrapher.isHighlightInZeroOutZero",
      },
    ];

    this.generalBoolSettings = [
      {
        text: "Perform layout on changes",
        isEnable: false,
        path2userPref: "isAutoIncrementalLayoutOnChange",
      },
      {
        text: "Emphasize on hover",
        isEnable: false,
        path2userPref: "isHighlightOnHover",
      },
      {
        text: "Show overview window",
        isEnable: false,
        path2userPref: "isShowOverviewWindow",
      },
      {
        text: "Show edge labels",
        isEnable: false,
        path2userPref: "isShowEdgeLabels",
      },
      {
        text: "Ignore case in text operations",
        isEnable: false,
        path2userPref: "isIgnoreCaseInText",
      },
      {
        text: "Show results of latest query only",
        isEnable: false,
        path2userPref: "isOnlyHighlight4LatestQuery",
      },
      {
        text: "Collapse multiple edges based on type",
        isEnable: false,
        path2userPref: "isCollapseEdgesBasedOnType",
      },
      {
        text: "Collapse multiple edges on load",
        isEnable: false,
        path2userPref: "isCollapseMultiEdgesOnLoad",
      },
      {
        text: "Tile disconnected nodes on layout",
        isEnable: true,
        path2userPref: "isTileDisconnectedOnLayout",
      },
    ];

    this.isInit = true;

    this.tabChangeSubs = this._g.operationTabChanged.subscribe((x) => {
      if (x == 3) {
        // check if my tab is opened
        this.fillUIFromMemory();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.loadFromFileSubs) {
      this.loadFromFileSubs.unsubscribe();
    }
    if (this.tabChangeSubs) {
      this.tabChangeSubs.unsubscribe();
    }
  }

  private fillUIFromMemory() {
    // reference variables for shorter text
    const up = this._g.userPrefs;
    const up_p = this._g.userPrefs.pangenomegrapher;

    this.generalBoolSettings[0].isEnable =
      up.isAutoIncrementalLayoutOnChange.getValue();
    this.generalBoolSettings[1].isEnable = up.isHighlightOnHover.getValue();
    this.generalBoolSettings[2].isEnable = up.isShowOverviewWindow.getValue();
    this.generalBoolSettings[3].isEnable = up.isShowEdgeLabels.getValue();
    this.generalBoolSettings[4].isEnable = up.isIgnoreCaseInText.getValue();
    this.generalBoolSettings[5].isEnable =
      up.isOnlyHighlight4LatestQuery.getValue();
    this.generalBoolSettings[6].isEnable =
      up.isCollapseEdgesBasedOnType.getValue();
    this.generalBoolSettings[7].isEnable =
      up.isCollapseMultiEdgesOnLoad.getValue();
    this.generalBoolSettings[8].isEnable =
      up.isTileDisconnectedOnLayout.getValue();

    this.nodeLabelWrap = up.nodeLabelWrap.getValue();
    this.mergedElemIndicator = up.mergedElemIndicator.getValue();
    this.groupingOption = up.groupingOption.getValue();
    this.dataPageSize = up.dataPageSize.getValue();
    this.dataPageLimit = up.dataPageLimit.getValue();
    this.queryHistoryLimit = up.queryHistoryLimit.getValue();
    this.dbTimeout = up.dbTimeout.getValue();
    this.tableColumnLimit = up.tableColumnLimit.getValue();
    this.edgeCollapseLimit = up.edgeCollapseLimit.getValue();

    this.currHighlightStyles = up.highlightStyles.map((_, i) => {
      return this.getHighlightStyleName(i);
    });
    this.highlightStyleIdx = up.currHighlightIdx.getValue();
    this.highlightColor =
      up.highlightStyles[
        this._g.userPrefs.currHighlightIdx.getValue()
      ].color.getValue();
    this.highlightWidth =
      up.highlightStyles[
        this._g.userPrefs.currHighlightIdx.getValue()
      ].wid.getValue();

    this.selectionColor = up.selectionColor.getValue();
    this.selectionWidth = up.selectionWidth.getValue();
    this._g.cy
      .style()
      .selector("core")
      .style({ "selection-box-color": this.selectionColor });
    this.compoundPadding = up.compoundPadding.getValue();
    this.isStoreUserProfile = up.isStoreUserProfile.getValue();
    this.queryResultPagination = up.queryResultPagination.getValue();

    this.lengthOfUpDownstream = up_p.lengthOfUpDownstream.getValue();
    this.pangenomegrapherBoolSettings[0].isEnable =
      up_p.isHighlightInZeroOutZero.getValue();

    this.setHighlightStyles();
    this.highlightStyleSelected(this._g.userPrefs.currHighlightIdx.getValue());
  }

  private setHighlightStyles() {
    if (!this._g.viewUtils) {
      return;
    }
    this.currHighlightStyles = [];
    let styles = this._g.viewUtils.getHighlightStyles();
    for (let i = 0; i < styles.length; i++) {
      this.currHighlightStyles.push(this.getHighlightStyleName(i));
      let c = styles[i].node["underlay-color"];
      let w = styles[i].node["underlay-padding"];
      if (this._g.userPrefs.highlightStyles[i]) {
        this._g.userPrefs.highlightStyles[i].color.next(c);
        this._g.userPrefs.highlightStyles[i].wid.next(w);
      } else {
        this._g.userPrefs.highlightStyles[i] = {
          wid: new BehaviorSubject<number>(w),
          color: new BehaviorSubject<string>(c),
        };
      }
    }
    this._g.userPrefs.highlightStyles.splice(styles.length);
    this._profile.saveUserPrefs();
  }

  private getHighlightStyleName(i: number) {
    if (i < HIGHLIGHT_NAMES.length) {
      return HIGHLIGHT_NAMES[i];
    } else {
      return "Style " + (i + 1);
    }
  }

  // set view utils extension highlight styles from memory (_g.userPrefs)
  private setViewUtilsStyle() {
    const styles = this._g.userPrefs.highlightStyles;
    let vuStyles = this._g.viewUtils.getHighlightStyles();
    for (let i = 0; i < vuStyles.length; i++) {
      let cyStyle = getCyStyleFromColorAndWid(
        styles[i].color.getValue(),
        styles[i].wid.getValue()
      );
      this._g.viewUtils.changeHighlightStyle(i, cyStyle.node, cyStyle.edge);
    }
    for (let i = vuStyles.length; i < styles.length; i++) {
      let cyStyle = getCyStyleFromColorAndWid(
        styles[i].color.getValue(),
        this.highlightWidth
      );
      this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    }
  }

  settingChanged(val: any, userPref: string) {
    let path = userPref.split(".");
    let obj = this._g.userPrefs[path[0]];
    for (let i = 1; i < path.length; i++) {
      obj = obj[path[i]];
    }
    obj.next(val);
    this._profile.saveUserPrefs();
  }

  onColorSelected(c: string) {
    this.highlightColor = c;
  }

  onSelColorSelected(c: string) {
    this._g.userPrefs.selectionColor.next(c);
    this.selectionColor = c;
    this._g.cy
      .style()
      .selector("core")
      .style({ "selection-box-color": this.selectionColor });
    this._g.cy
      .style()
      .selector(":selected")
      .style({ "overlay-color": this.selectionColor })
      .update();
    this._profile.saveUserPrefs();
  }

  onSelWidSelected(w: any) {
    let width = parseFloat(w.target.value);
    if (Number(width)) {
      if (width < 0) width = 1;
      else if (width > 20) width = 20;
      this._g.userPrefs.selectionWidth.next(width);
      this.selectionWidth = width;
      this._g.cy
        .style()
        .selector(":selected")
        .style({ "overlay-padding": width })
        .selector("edge:selected")
        .style({
          "overlay-padding": (e: any) => {
            return (width + e.width()) / 2 + "px";
          },
        })
        .update();
      this._profile.saveUserPrefs();
    } else {
      this._g.userPrefs.selectionWidth.next(1);
      this.selectionWidth = this._g.userPrefs.selectionWidth.getValue();
      w.target.valueAsNumber = this.selectionWidth;
    }
  }

  onlengthOfUpDownstreamSelected(x: any) {
    let length = parseInt(x.target.value);
    if (length > MAX_LENGTH_OF_UP_DOWN_STREAM) {
      length = MAX_LENGTH_OF_UP_DOWN_STREAM;
    }
    if (length < MIN_LENGTH_OF_UP_DOWN_STREAM) {
      length = MIN_LENGTH_OF_UP_DOWN_STREAM;
    }
    this._g.userPrefs.pangenomegrapher.lengthOfUpDownstream.next(length);
    this.lengthOfUpDownstream = length;
  }

  // used to change border width or color. One of them should be defined. (exclusively)
  changeHighlightStyle() {
    this.bandPassHighlightWidth();
    let cyStyle = getCyStyleFromColorAndWid(
      this.highlightColor,
      this.highlightWidth
    );
    this._g.viewUtils.changeHighlightStyle(
      this.highlightStyleIdx,
      cyStyle.node,
      cyStyle.edge
    );
    this.setHighlightStyles();
    this._g.updateSelectionCyStyle();
  }

  deleteHighlightStyle() {
    if (this._g.viewUtils.getAllHighlightClasses().length < 2) {
      return;
    }
    this._g.viewUtils.removeHighlightStyle(this.highlightStyleIdx);
    this.setHighlightStyles();
    let styleCnt = this._g.viewUtils.getAllHighlightClasses().length - 1;
    if (this.highlightStyleIdx > styleCnt) {
      this.highlightStyleIdx = styleCnt;
    }
    this.highlightStyleSelected(this.highlightStyleIdx);
  }

  addHighlightStyle() {
    this.bandPassHighlightWidth();
    let cyStyle = getCyStyleFromColorAndWid(
      this.highlightColor,
      this.highlightWidth
    );
    this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    this.setHighlightStyles();
    this.highlightStyleIdx = this.currHighlightStyles.length - 1;
    this.highlightStyleSelected(this.highlightStyleIdx);
    this._g.updateSelectionCyStyle();
  }

  highlightStyleSelected(t: EventTarget | number) {
    let i = 0;
    if (typeof t == "number") {
      i = t;
    } else {
      i = (<HTMLSelectElement>t).selectedIndex;
    }
    this.highlightStyleIdx = i;
    this._g.userPrefs.currHighlightIdx.next(i);
    let style = this._g.viewUtils.getHighlightStyles()[i];
    this.highlightColor = style.node["underlay-color"];
    this.highlightWidth = style.node["underlay-padding"];
    this._profile.saveUserPrefs();
  }

  bandPassHighlightWidth() {
    if (this.highlightWidth < MIN_HIGHTLIGHT_WIDTH) {
      this.highlightWidth = MIN_HIGHTLIGHT_WIDTH;
    }
    if (this.highlightWidth > MAX_HIGHTLIGHT_WIDTH) {
      this.highlightWidth = MAX_HIGHTLIGHT_WIDTH;
    }
  }

  resetGeneralSettings() {
    this.transferSubjectValues(this._g.userPrefsFromFiles, this._g.userPrefs, [
      "pangenographer",
    ]);
    this.setViewUtilsStyle();
    this.fillUIFromMemory();
    this._g.updateSelectionCyStyle();
  }

  resetPangenographerSettings() {
    this.transferSubjectValues(
      this._g.userPrefsFromFiles.pangenomegrapher,
      this._g.userPrefs.pangenomegrapher
    );
    this.fillUIFromMemory();
  }

  private transferSubjectValues(from: any, to: any, skip = null) {
    for (const k in from) {
      if ((skip && k == skip[0]) || (skip && k == skip[1])) {
        continue;
      }
      let p1 = from[k];
      let p2 = to[k];
      if (p1 instanceof BehaviorSubject) {
        (p2 as BehaviorSubject<any>).next(
          (p1 as BehaviorSubject<any>).getValue()
        );
      } else {
        this.transferSubjectValues(p1, p2);
      }
    }
  }
}
