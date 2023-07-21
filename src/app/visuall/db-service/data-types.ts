import { ClassBasedRules } from "../operation-tabs/map-tab/query-types";
import { TableFiltering } from "../../shared/table-view/table-view-types";

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
  loadGFA(GFAdata: any);
}

export interface GraphResponse {
  nodes: CyNode[];
  edges: CyEdge[];
}

export interface CyNode {
  id: string;
  labels: string[];
  properties?: any;
}

export interface CyEdge {
  id: string;
  properties?: any;
  startNode: string | number;
  endNode: string | number;
  type: string;
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
