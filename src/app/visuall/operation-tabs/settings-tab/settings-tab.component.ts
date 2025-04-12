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
  MAX_HIGHLIGHT_WIDTH,
  MAX_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH,
  MAX_LENGTH_OF_UP_DOWN_STREAM,
  MIN_HIGHLIGHT_WIDTH,
  MIN_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH,
  MIN_LENGTH_OF_UP_DOWN_STREAM,
  PANGENOGRAPHER_SETTING_NAMES,
  getCyStyleFromColorAndWid,
} from "../../constants";
import { GlobalVariableService } from "../../global-variable.service";
import {
  BoolSetting,
  GroupingOptionTypes,
  MergedElementIndicatorTypes,
} from "../../user-preference";
import { UserProfileService } from "../../user-profile.service";

@Component({
  selector: "app-settings-tab",
  templateUrl: "./settings-tab.component.html",
  styleUrls: ["./settings-tab.component.css"],
})
export class SettingsTabComponent implements OnInit, OnDestroy {
  @ViewChild("dbQueryDate1", { static: false }) dbQueryDate1: ElementRef;
  @ViewChild("dbQueryDate2", { static: false }) dbQueryDate2: ElementRef;
  compoundPadding: string;
  currentHighlightStyles: string[] = [];
  dataPageLimit: number;
  queryResultPageSize: number;
  dbTimeout: number;
  edgeCollapseLimit: number;
  generalBoolSettings: BoolSetting[];
  groupingOption: GroupingOptionTypes;
  groupingOptions: string[] = ["Compounds", "Circles"];
  highlightColor: string;
  highlightStyleIdx = 0;
  highlightWidth: number;
  isInit: boolean = false;
  isStoreUserProfile: boolean = true;
  lengthOfBlastSelectedSegmentsPath: number;
  lengthOfUpDownstream: number;
  loadFromFileSubscription: Subscription;
  mergedElementIndicator: MergedElementIndicatorTypes;
  mergedElementIndicators: string[] = ["None", "Selection", "Highlight"];
  nodeLabelWrap: number = 0;
  pangenographerBoolSettings: BoolSetting[];
  queryHistoryLimit: number;
  queryResultPagination: "Client" | "Server";
  seedSourceTargetCount: number; // seed source target count of the get some zero degree nodes
  selectionColor = "#6c757d";
  selectionWidth = 4.5;
  sizeOfGetSampleData: number; // size of get sample data
  sizeOfNeo4jQueryBatchesInCharacters: number; // size of Neo4j query batches in characters
  sizeOfNeo4jQueryBatchesInLines: number; // size of Neo4j query batches in lines
  segmentDataSizeQueryLimit: number; // segment data size query limit
  tabChangeSubscription: Subscription;
  tableColumnLimit: number;

  constructor(
    private _g: GlobalVariableService,
    private _profile: UserProfileService
  ) {
    this.loadFromFileSubscription = this._profile.onLoadFromFile.subscribe(
      (x) => {
        if (!x) {
          return;
        }
        this._profile.transferUserPreferences();
        this.setViewUtilsStyle();
        this.fillUIFromMemory();
      }
    );
  }

  ngOnInit() {
    this.pangenographerBoolSettings = [
      {
        text: "Highlight in/out-degree zero nodes",
        isEnable: true,
        path2userPref: "isHighlightInZeroOutZero",
      },
      {
        text: "Enable/disable show up/downstream cues",
        isEnable: true,
        path2userPref: "isShowUpDownstreamCues",
      },
    ];

    this.generalBoolSettings = [
      {
        text: "Perform layout on changes",
        isEnable: false,
        path2userPref: "isAutoIncrementalLayoutOnChange",
      },
      {
        text: "Highlight on hover",
        isEnable: false,
        path2userPref: "isHighlightOnHover",
        title:
          "Highlights the node and its edges when hovered over, the color can be changed in the highlight style settings. This also applies to the table view.",
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

    this.tabChangeSubscription = this._g.operationTabChanged.subscribe((x) => {
      if (x == 3) {
        // check if my tab is opened
        this.fillUIFromMemory();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.loadFromFileSubscription) {
      this.loadFromFileSubscription.unsubscribe();
    }
    if (this.tabChangeSubscription) {
      this.tabChangeSubscription.unsubscribe();
    }
  }

  private fillUIFromMemory() {
    // reference variables for shorter text
    const up = this._g.userPreferences;

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
    this.mergedElementIndicator = up.mergedElementIndicator.getValue();
    this.groupingOption = up.groupingOption.getValue();
    this.queryResultPageSize = up.queryResultPageSize.getValue();
    this.dataPageLimit = up.dataPageLimit.getValue();
    this.queryHistoryLimit = up.queryHistoryLimit.getValue();
    this.dbTimeout = up.dbTimeout.getValue();
    this.tableColumnLimit = up.tableColumnLimit.getValue();
    this.edgeCollapseLimit = up.edgeCollapseLimit.getValue();

    this.currentHighlightStyles = up.highlightStyles.map((_, i) => {
      return this.getHighlightStyleName(i);
    });
    this.highlightStyleIdx = up.currHighlightIdx.getValue();
    this.highlightColor =
      up.highlightStyles[
        this._g.userPreferences.currHighlightIdx.getValue()
      ].color.getValue();
    this.highlightWidth =
      up.highlightStyles[
        this._g.userPreferences.currHighlightIdx.getValue()
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

    this.lengthOfBlastSelectedSegmentsPath =
      up.lengthOfBlastSelectedSegmentsPath.getValue();
    this.lengthOfUpDownstream = up.lengthOfUpDownstream.getValue(); // get the length of the upstream and downstream
    this.pangenographerBoolSettings[0].isEnable =
      up.isHighlightInZeroOutZero.getValue();
    this.pangenographerBoolSettings[1].isEnable =
      up.isShowUpDownstreamCues.getValue();
    this.seedSourceTargetCount = up.seedSourceTargetCount.getValue(); // get the seed source target count of the get some zero degree nodes
    this.sizeOfGetSampleData = up.sizeOfGetSampleData.getValue(); // get the size of get sample data
    this.sizeOfNeo4jQueryBatchesInCharacters =
      up.sizeOfNeo4jQueryBatchesInCharacters.getValue(); // get the size of the Neo4j query batches in characters
    this.sizeOfNeo4jQueryBatchesInLines =
      up.sizeOfNeo4jQueryBatchesInLines.getValue(); // get the size of the Neo4j query batches in lines
    this.segmentDataSizeQueryLimit = up.segmentDataSizeQueryLimit.getValue(); // get the segment data size query limit

    this.setHighlightStyles();
    this.highlightStyleSelected(
      this._g.userPreferences.currHighlightIdx.getValue()
    );
  }

  private setHighlightStyles() {
    if (!this._g.viewUtils) {
      return;
    }
    this.currentHighlightStyles = [];
    let styles = this._g.viewUtils.getHighlightStyles();
    for (let i = 0; i < styles.length; i++) {
      this.currentHighlightStyles.push(this.getHighlightStyleName(i));
      let c = styles[i].node["underlay-color"];
      let w = styles[i].node["underlay-padding"];
      if (this._g.userPreferences.highlightStyles[i]) {
        this._g.userPreferences.highlightStyles[i].color.next(c);
        this._g.userPreferences.highlightStyles[i].wid.next(w);
      } else {
        this._g.userPreferences.highlightStyles[i] = {
          wid: new BehaviorSubject<number>(w),
          color: new BehaviorSubject<string>(c),
        };
      }
    }
    this._g.userPreferences.highlightStyles.splice(styles.length);
    this._profile.saveUserPreferences();
  }

  private getHighlightStyleName(i: number) {
    if (i < HIGHLIGHT_NAMES.length) {
      return HIGHLIGHT_NAMES[i];
    } else {
      return "Style " + (i + 1);
    }
  }

  // set view utils extension highlight styles from memory (_g.userPreferences)
  private setViewUtilsStyle() {
    const styles = this._g.userPreferences.highlightStyles;
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

  settingChanged(value: any, userPreference: string) {
    let path = userPreference.split(".");
    let object = this._g.userPreferences[path[0]];
    for (let i = 1; i < path.length; i++) {
      object = object[path[i]];
    }
    object.next(value);
    this._profile.saveUserPreferences();
  }

  onColorSelected(c: string) {
    this.highlightColor = c;
  }

  onSelColorSelected(c: string) {
    this._g.userPreferences.selectionColor.next(c);
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
    this._profile.saveUserPreferences();
  }

  onSelWidSelected(w: any) {
    let width = parseFloat(w.target.value);
    if (Number(width)) {
      if (width < 0) width = 1;
      else if (width > 20) width = 20;
      this._g.userPreferences.selectionWidth.next(width);
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
      this._profile.saveUserPreferences();
    } else {
      this._g.userPreferences.selectionWidth.next(1);
      this.selectionWidth = this._g.userPreferences.selectionWidth.getValue();
      w.target.valueAsNumber = this.selectionWidth;
    }
  }

  onLengthOfUpDownstreamSelected(x: any) {
    let length = parseInt(x.target.value);
    if (length > MAX_LENGTH_OF_UP_DOWN_STREAM) {
      length = MAX_LENGTH_OF_UP_DOWN_STREAM;
    }
    if (length < MIN_LENGTH_OF_UP_DOWN_STREAM) {
      length = MIN_LENGTH_OF_UP_DOWN_STREAM;
    }

    // set the length of the upstream and downstream in the user preferences
    this._g.userPreferences.lengthOfUpDownstream.next(length);

    // set the length of the upstream and downstream in the current component
    this.lengthOfUpDownstream = length;

    // save the user preferences
    this._profile.saveUserPreferences();
  }

  // Used to change the size of the Neo4j query batches in characters in the user preferences
  // and the current component when the user selects a new size
  onsizeOfNeo4jQueryBatchesInCharactersSelected(x: any) {
    let size = parseInt(x.target.value);

    // if the size is less than 1, set it to 1
    if (size < 1) {
      size = 1;
    }

    // set the size of the Neo4j query batches in characters in the user preferences
    this._g.userPreferences.sizeOfNeo4jQueryBatchesInCharacters.next(size);

    // set the size of the Neo4j query batches in characters in the current component
    this.sizeOfNeo4jQueryBatchesInCharacters = size;

    // save the user preferences
    this._profile.saveUserPreferences();
  }

  // Used to change the size of the Neo4j query batches in the user preferences
  // and the current component when the user selects a new size
  onsizeOfNeo4jQueryBatchesInLinesSelected(x: any) {
    let size = parseInt(x.target.value);

    // if the size is less than 1, set it to 1
    if (size < 1) {
      size = 1;
    }

    // set the size of the Neo4j query batches in the user preferences
    this._g.userPreferences.sizeOfNeo4jQueryBatchesInLines.next(size);

    // set the size of the Neo4j query batches in the current component
    this.sizeOfNeo4jQueryBatchesInLines = size;

    // save the user preferences
    this._profile.saveUserPreferences();
  }

  // Used to change the segment data size query limit in the user preferences and the current component when the user selects a new limit
  onSegmentDataSizeQueryLimitSelected(x: any) {
    let limit = parseInt(x.target.value);
    if (limit < 1) {
      limit = 1;
    }
    this._g.userPreferences.segmentDataSizeQueryLimit.next(limit);
    this.segmentDataSizeQueryLimit = limit;
    this._profile.saveUserPreferences();
  }

  // Used to change the size of the get sample data in the user preferences and the current component when the user selects a new size
  onSizeOfGetSampleDataSelected(x: any) {
    let size = parseInt(x.target.value);

    // if the size is less than 1, set it to 1
    if (size < 1) {
      size = 1;
    }

    // set the size of the get sample data in the user preferences
    this._g.userPreferences.sizeOfGetSampleData.next(size);

    // set the size of the get sample data in the current component
    this.sizeOfGetSampleData = size;

    // save the user preferences
    this._profile.saveUserPreferences();
  }

  // Used to change the seed source target count of the get some zero degree nodes
  // in the user preferences and the current component when the user selects a new count
  onSeedSourceTargetCount(x: any) {
    let count = parseInt(x.target.value);

    // if the count is less than 1, set it to 1
    if (count < 1) {
      count = 1;
    }

    // set the seed source target count of the get some zero degree nodes in the user preferences
    this._g.userPreferences.seedSourceTargetCount.next(count);

    // set the seed source target count of the get some zero degree nodes in the current component
    this.seedSourceTargetCount = count;

    // save the user preferences
    this._profile.saveUserPreferences();
  }

  onLengthOfBlastSelectedSegmentsPathSelected(x: any) {
    let length = parseInt(x.target.value);
    if (length > MAX_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH) {
      length = MAX_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH;
    }
    if (length < MIN_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH) {
      length = MIN_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH;
    }
    this._g.userPreferences.lengthOfBlastSelectedSegmentsPath.next(length);
    this.lengthOfBlastSelectedSegmentsPath = length;

    // save the user preferences
    this._profile.saveUserPreferences();
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
    this.highlightStyleIdx = this.currentHighlightStyles.length - 1;
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
    this._g.userPreferences.currHighlightIdx.next(i);
    let style = this._g.viewUtils.getHighlightStyles()[i];
    this.highlightColor = style.node["underlay-color"];
    this.highlightWidth = style.node["underlay-padding"];
    this._profile.saveUserPreferences();
  }

  bandPassHighlightWidth() {
    if (this.highlightWidth < MIN_HIGHLIGHT_WIDTH) {
      this.highlightWidth = MIN_HIGHLIGHT_WIDTH;
    }
    if (this.highlightWidth > MAX_HIGHLIGHT_WIDTH) {
      this.highlightWidth = MAX_HIGHLIGHT_WIDTH;
    }
  }

  resetGeneralSettings() {
    this.transferSubjectValues(
      this._g.userPreferencesFromFiles,
      this._g.userPreferences,
      PANGENOGRAPHER_SETTING_NAMES
    );
    this.setViewUtilsStyle();
    this.fillUIFromMemory();
    this._g.updateSelectionCyStyle();
  }

  // Reset the PanGenoGrapher settings to the default values
  resetPanGenoGrapherSettings() {
    this.transferSubjectValues(
      this._g.userPreferencesFromFiles,
      this._g.userPreferences,
      null, // Skipped values
      PANGENOGRAPHER_SETTING_NAMES // Included values
    );
    this.fillUIFromMemory();
  }

  // Transfer values from one object to another, where the values are BehaviorSubjects
  // If the value is a BehaviorSubject, then the value of the BehaviorSubject is transferred
  // Otherwise, the function is called recursively, transferring the values of the nested object
  // Additionally, if the key is in the skip array, then the value is not transferred
  // Additionally, If the key is in the include array, then the value is transferred
  private transferSubjectValues(
    from: any,
    to: any,
    skip = null,
    include = null
  ) {
    for (const k in from) {
      // if the key is in the skip array, then skip the key
      if (skip && skip.includes(k)) {
        continue;
      }

      // if the key is in the include array, then include the key
      if (include && !include.includes(k)) {
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
