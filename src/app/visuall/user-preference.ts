import { BehaviorSubject } from "rxjs";
import { QueryRule } from "./operation-tabs/map-tab/query-types";

export interface UserPreferences {
  compoundPadding: BehaviorSubject<string>;
  currHighlightIdx: BehaviorSubject<number>;
  dataPageLimit: BehaviorSubject<number>;
  dataPageSize: BehaviorSubject<number>;
  dbTimeout: BehaviorSubject<number>;
  edgeCollapseLimit: BehaviorSubject<number>;
  groupingOption: BehaviorSubject<GroupingOptionTypes>;
  highlightStyles: {
    wid: BehaviorSubject<number>;
    color: BehaviorSubject<string>;
  }[];
  isAutoIncrementalLayoutOnChange: BehaviorSubject<boolean>;
  isCollapseEdgesBasedOnType: BehaviorSubject<boolean>;
  isCollapseMultiEdgesOnLoad: BehaviorSubject<boolean>;
  isHighlightOnHover: BehaviorSubject<boolean>;
  isIgnoreCaseInText: BehaviorSubject<boolean>;
  isLimitDbQueries2range: BehaviorSubject<boolean>;
  isOnlyHighlight4LatestQuery: BehaviorSubject<boolean>;
  isShowEdgeLabels: BehaviorSubject<boolean>;
  isShowOverviewWindow: BehaviorSubject<boolean>;
  isStoreUserProfile: BehaviorSubject<boolean>;
  isTileDisconnectedOnLayout: BehaviorSubject<boolean>;
  mergedElementIndicator: BehaviorSubject<MergedElementIndicatorTypes>;
  nodeLabelWrap: BehaviorSubject<TextWrapTypes>;
  queryHistoryLimit: BehaviorSubject<number>;
  queryResultPagination: BehaviorSubject<"Client" | "Server">;
  savedLists: SavedLists;
  selectionColor: BehaviorSubject<string>;
  selectionWidth: BehaviorSubject<number>;
  tableColumnLimit: BehaviorSubject<number>;
  tilingPadding: BehaviorSubject<number>;

  // PanGenoGrapher Settings
  isHighlightInZeroOutZero: BehaviorSubject<boolean>; // highlight in zero out zero
  isShowUpDownstreamCues: BehaviorSubject<boolean>; // show upstream/downstream cues
  lengthOfUpDownstream: BehaviorSubject<number>; // length of upstream/downstream
  lengthOfBlastSelectedSegmentsPath: BehaviorSubject<number>; // length of blast selected segments path
  seedSourceTargetCount: BehaviorSubject<number>; // seed source target count
  sizeOfNeo4jQueryBatchesInCharacters: BehaviorSubject<number>; // size of neo4j query batches in characters
  sizeOfNeo4jQueryBatchesInLines: BehaviorSubject<number>; // size of neo4j query batches in lines
  sizeOfGetSampleData: BehaviorSubject<number>; // size of get sample data
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
