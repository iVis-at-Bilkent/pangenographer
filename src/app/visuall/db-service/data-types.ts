import { TableFiltering } from "../../shared/table-view/table-view-types";
import { ClassBasedRules } from "../operation-tabs/map-tab/query-types";

export interface DbService {
  getNeighbors(
    elemIds: string[] | number[],
    callback: (x: GraphResponse) => any,
    queryMeta?: DbQueryMeta
  );
  getElems(
    ids: string[] | number[],
    callback: (x: GraphResponse) => any,
    meta: DbQueryMeta
  );
  getSampleData(callback: (x: GraphResponse) => any);
  getFilteringResult(
    rules: ClassBasedRules,
    filter: TableFiltering,
    skip: number,
    limit: number,
    type: DbResponseType,
    callback: (x: GraphResponse | TableResponse) => any
  );
  getGraphOfInterest(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    isDirected: boolean,
    type: DbResponseType,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x) => void
  );
  getCommonStream(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    dir: Neo4jEdgeDirection,
    type: DbResponseType,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x) => void
  );
  getNeighborhood(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    isDirected: boolean,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x) => void
  );
  getConsecutiveNodes(
    properties: (string | number)[],
    propertyType: string,
    objectType: string,
    callback: (x: GraphResponse) => any
  );
  importGFA(GFAData: GFAData, cb?: () => void);
  clearData();
  getElementsUpToCertainDistance(
    nodeId: string,
    distance: number,
    callback: (x: GraphResponse) => any,
    isUp: boolean
  );
  getPathWalkData(callback: (x: GraphResponse) => any);
}

export interface GraphResponse {
  nodes: CyNode[];
  edges: CyEdge[];
}

export interface CyNode {
  elementId: string;
  labels: string[];
  properties?: any;
}

export interface CyEdge {
  elementId: string;
  properties?: any;
  startNodeElementId: string;
  endNodeElementId: string;
  type: string;
}

export interface GFAData {
  segments: GFASegment[];
  links: GFALink[];
  jumps: GFAJump[];
  containments: GFAContainment[];
  paths: GFAPath[];
  walks: GFAWalk[];
}

export interface GFASegment {
  segmentData: string;
  segmentName: string;
  segmentLength: number;
  id: string;
  readCount?: number;
  fragmentCount?: number;
  kmerCount?: number;
  SHA256Checksum?: string;
  URIorLocalSystemPath?: string;
}

export interface GFALink {
  source: string;
  sourceOrientation: string;
  target: string;
  targetOrientation: string;
  overlap: string;
  mappingQuality?: number;
  numberOfMismatchesOrGaps?: number;
  readCount?: number;
  fragmentCount?: number;
  kmerCount?: number;
  edgeIdentifier?: string;
}

export interface GFAJump {
  source: string;
  sourceOrientation: string;
  target: string;
  targetOrientation: string;
  distance: string;
  indirectShortcutConnections?: number;
}

export interface GFAContainment {
  source: string;
  sourceOrientation: string;
  target: string;
  targetOrientation: string;
  pos: number;
  overlap: string;
  readCount?: number;
  numberOfMismatchesOrGaps?: number;
  edgeIdentifier?: string;
}

export interface GFAPath {
  pathName: string;
  segmentNames: string;
  overlaps: string;
}

export interface GFAWalk {
  sampleId: string;
  hapIndex: number;
  seqId: string;
  seqStart: number;
  seqEnd: number;
  walk: string;
}

export interface TableResponse {
  columns: string[];
  data: any[][];
}

export enum Neo4jEdgeDirection {
  OUTGOING = 0,
  INCOMING = 1,
  BOTH = 2,
}

export interface GraphHistoryItem {
  expo: string;
  base64png: string;
  json: any;
}

export interface HistoryMetaData {
  labels?: string;
  isNode?: boolean;
  customTxt?: string;
}

export interface DbQueryMeta {
  edgeType?: string | string[];
  targetType?: string;
  isMultiLength?: boolean;
  isEdgeQuery?: boolean;
}

export interface GraphElem {
  data: any;
  classes: string;
}

export interface ElemAsQueryParam {
  dbId: string;
  label: string;
}

export interface DbResponse {
  tableData: TableResponse;
  graphData: GraphResponse;
  count: number;
}

export enum DbResponseType {
  graph = 0,
  table = 1,
  generic = 2,
  count = 3,
  raw = 4,
}
