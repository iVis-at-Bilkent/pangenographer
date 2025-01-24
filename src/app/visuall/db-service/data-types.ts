import { TableFiltering } from "../../shared/table-view/table-view-types";
import { ClassBasedRules } from "../operation-tabs/map-tab/query-types";

export interface DbService {
  getNeighbors(
    elementIds: string[] | number[],
    callback: (x: GraphResponse) => any,
    queryMeta?: DbQueryMeta
  );

  getElements(
    ids: string[] | number[],
    callback: (x: GraphResponse) => any,
    meta: DbQueryMeta
  );

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
    cb: (x: any) => void
  );

  getCommonStream(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    dir: Neo4jEdgeDirection,
    type: DbResponseType,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x: any) => void
  );

  getNeighborhood(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    isDirected: boolean,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x: any) => void
  );

  sequenceChainSearch(
    sequences: string,
    maxJumpLength: number,
    minSubsequenceMatchLength: number,
    dbResponseType: DbResponseType,
    callback: (x: GraphResponse) => any
  );

  getConsecutiveNodes(
    properties: (string | number)[],
    propertyType: string,
    objectType: string,
    callback: (x: GraphResponse) => any
  );

  getElementsUpToCertainDistance(
    nodeIds: string[],
    distance: number,
    callback: (x: GraphResponse) => any,
    isUp: boolean
  );

  importGFA(GFAData: GFAData, cb: () => void);
  // import GFA data with a sequence of promises
  importGFAPromised(GFAData: GFAData): Promise<any>;

  clearDatabase(cb: () => void);

  getSampleData(callback: (x: GraphResponse) => any);

  getSomeZeroDegreeNodes(callback: (x: GraphResponse) => any);

  getAllZeroDegreeNodes(callback: (x: GraphResponse) => any);

  getAllZeroIncomingDegreeNodes(callback: (x: GraphResponse) => any);

  getAllZeroOutgoingDegreeNodes(callback: (x: GraphResponse) => any);

  getSegmentsByNames(
    segmentNames: string[],
    callback: (x: GraphResponse) => any
  );
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
  segmentsData: GFASegmentData[];
  links: GFALink[];
  jumps: GFAJump[];
  containments: GFAContainment[];
  paths: GFAPath[];
  pathSegments: GFAPathSegment[];
  pathEdges: GFAPathEdge[];
  walks: GFAWalk[];
  walkSegments: GFAWalkSegment[];
  walkEdges: GFAWalkEdge[];
}

export interface GFASegment {
  segmentData: string;
  segmentName: string;
  segmentLength: number;
  id: string;
  elementId?: string;
  stableSequenceName?: string;
  stableSequenceOffset?: number;
  stableSequenceRank?: number;
  readCount?: number;
  fragmentCount?: number;
  kmerCount?: number;
  Sha256Checksum?: string;
  UriOrLocalSystemPath?: string;
  pathNames?: string;
  walkSampleIdentifiers?: string;
}

export interface GFASegmentData {
  segmentData: string;
  segmentName: string;
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

export interface GFAPathData {
  path: GFAPath;
  segments: GFAPathSegment[];
  edges: GFAPathEdge[];
}

export interface GFAPathSegment {
  pathName: string;
  segmentName: string;
}

export interface GFAPathEdge {
  pathName: string;
  source: string;
  sourceOrientation: string;
  target: string;
  targetOrientation: string;
  overlap?: string; // Undefined for links, J for jumps
}

export interface GFAWalk {
  sampleIdentifier: string;
  haplotypeIndex: string;
  sequenceIdentifier: string;
  sequenceStart: string;
  sequenceEnd: string;
  walk: string;
}

export interface GFAWalkData {
  walk: GFAWalk;
  segments: GFAWalkSegment[];
  edges: GFAWalkEdge[];
}

export interface GFAWalkSegment {
  segmentName: string;
  sampleIdentifier: string;
}

export interface GFAWalkEdge {
  sampleIdentifier: string;
  source: string;
  sourceOrientation: string;
  target: string;
  targetOrientation: string;
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

export interface GraphElement {
  data: any;
  classes: string;
}

export interface ElementAsQueryParam {
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
