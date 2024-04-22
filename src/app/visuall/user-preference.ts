import { BehaviorSubject } from "rxjs";
import { QueryRule } from "./operation-tabs/map-tab/query-types";

export interface UserPreferences {
  // boolean settings
  isAutoIncrementalLayoutOnChange: BehaviorSubject<boolean>;
  isHighlightOnHover: BehaviorSubject<boolean>;
  isShowOverviewWindow: BehaviorSubject<boolean>;
  isShowEdgeLabels: BehaviorSubject<boolean>;
  isTileDisconnectedOnLayout: BehaviorSubject<boolean>;
  isIgnoreCaseInText: BehaviorSubject<boolean>;
  isOnlyHighlight4LatestQuery: BehaviorSubject<boolean>;
  isStoreUserProfile: BehaviorSubject<boolean>;
  isCollapseEdgesBasedOnType: BehaviorSubject<boolean>;
  isCollapseMultiEdgesOnLoad: BehaviorSubject<boolean>;

  // Show query results using 'Selection', 'Highlight'
  mergedElementIndicator: BehaviorSubject<MergedElementIndicatorTypes>;
  groupingOption: BehaviorSubject<GroupingOptionTypes>;
  nodeLabelWrap: BehaviorSubject<TextWrapTypes>;
  isLimitDbQueries2range: BehaviorSubject<boolean>;
  savedLists: SavedLists;
  dataPageSize: BehaviorSubject<number>;
  dataPageLimit: BehaviorSubject<number>;
  queryHistoryLimit: BehaviorSubject<number>;
  dbTimeout: BehaviorSubject<number>;
  tableColumnLimit: BehaviorSubject<number>;
  highlightStyles: {
    wid: BehaviorSubject<number>;
    color: BehaviorSubject<string>;
  }[];
  currHighlightIdx: BehaviorSubject<number>;
  compoundPadding: BehaviorSubject<string>;
  edgeCollapseLimit: BehaviorSubject<number>;
  queryResultPagination: BehaviorSubject<"Client" | "Server">;
  selectionColor: BehaviorSubject<string>;
  selectionWidth: BehaviorSubject<number>;
  tilingPadding: BehaviorSubject<number>;
  //  PanGenoGrapher Settings
  pangenographer: {
    lengthOfUpDownstream: BehaviorSubject<number>;
    lengthOfBlastSelectedSegmentsPath: BehaviorSubject<number>;
    isHighlightInZeroOutZero: BehaviorSubject<boolean>;
  };
}

export enum MergedElementIndicatorTypes {
  none = 0,
  selection = 1,
  highlight = 2,
}

export enum GroupingOptionTypes {
  compound = 0,
  clusterId = 1,
}

export enum TextWrapTypes {
  ellipsis = 0,
}

export interface BoolSetting {
  isEnable: boolean;
  text: string;
  path2userPref: string;
}

export interface UserProfile {
  queryRules: QueryRule[];
  userPreference: any;
}

export interface SavedLists {
  numberLists: {
    name: BehaviorSubject<string>;
    values: BehaviorSubject<string>[];
  }[];
  stringLists: {
    name: BehaviorSubject<string>;
    values: BehaviorSubject<string>[];
  }[];
  enumLists: {
    name: BehaviorSubject<string>;
    values: BehaviorSubject<string>[];
  }[];
}
