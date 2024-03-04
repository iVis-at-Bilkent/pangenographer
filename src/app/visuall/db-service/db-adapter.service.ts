import { Injectable } from "@angular/core";
import { TableFiltering } from "../../shared/table-view/table-view-types";
import { GlobalVariableService } from "../global-variable.service";
import {
  ClassBasedRules,
  rule2str2,
} from "../operation-tabs/map-tab/query-types";
import {
  DbQueryMeta,
  DbResponse,
  DbResponseType,
  DbService,
  GFAData,
  GraphResponse,
  HistoryMetaData,
  Neo4jEdgeDirection,
} from "./data-types";
import { Neo4jDb } from "./neo4j-db.service";

@Injectable({
  providedIn: "root",
})
// functions that are not defined due to interface DbService might be deleted
export class DbAdapterService {
  private _db: DbService;
  // put prefered database service type as argument
  constructor(private _g: GlobalVariableService, private db: Neo4jDb) {
    this._db = db;
  }

  getNeighbors(
    elemId: string[],
    callback: (x: GraphResponse) => any,
    historyMeta?: HistoryMetaData,
    queryMeta?: DbQueryMeta
  ) {
    let s = "";
    if (historyMeta) {
      s = historyMeta.labels;
      if (!historyMeta.labels) {
        s = this._g.getLabels4Elems(elemId, historyMeta.isNode);
      }
    }

    let txt = "Get neighbors of element(s): ";
    if (historyMeta && historyMeta.customTxt) {
      txt = historyMeta.customTxt;
    }
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory(txt + s);
    };
    this._db.getNeighbors(elemId, fn, queryMeta);
  }

  getElems(
    ids: string[],
    callback: (x: GraphResponse) => any,
    queryMeta: DbQueryMeta,
    historyMeta?: HistoryMetaData
  ) {
    let s = "";
    if (historyMeta) {
      s = historyMeta.labels;
      if (!historyMeta.labels) {
        s = this._g.getLabels4Elems(ids, historyMeta.isNode);
      }
    }

    let txt = "Get neighbors of element(s): ";
    if (historyMeta && historyMeta.customTxt) {
      txt = historyMeta.customTxt;
    }
    let fn = (x) => {
      callback(x);
      this._g.add2GraphHistory(txt + s);
    };
    this._db.getElems(ids, fn, queryMeta);
  }

  getElementsUpToCertainDistance(
    nodeId: string,
    distance: number,
    callback: (x: GraphResponse) => any,
    isUp: boolean
  ) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Show up/downstream");
    };
    this._db.getElementsUpToCertainDistance(nodeId, distance, fn, isUp);
  }

  getSampleData(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get sample data");
    };
    this._db.getSampleData(fn);
  }

  getPathWalkData(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get path walk data");
    };
    this._db.getPathWalkData(fn);
  }

  getConsecutiveNodes(
    properties: (string | number)[],
    propertyType: string,
    objectType: string,
    callback: (x: GraphResponse) => any
  ) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get consecutive nodes");
    };
    this._db.getConsecutiveNodes(properties, propertyType, objectType, fn);
  }

  getFilteringResult(
    rules: ClassBasedRules,
    filter: TableFiltering,
    skip: number,
    limit: number,
    type: DbResponseType,
    callback: (x: DbResponse) => any
  ) {
    let s = "Get " + rule2str2(rules);
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory(s);
    };
    this._db.getFilteringResult(rules, filter, skip, limit, type, fn);
  }

  getGraphOfInterest(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    isDirected: boolean,
    type: DbResponseType,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x: any) => void
  ) {
    let fn = cb;
    if (type == DbResponseType.table) {
      fn = (x) => {
        cb(x);
        this._g.add2GraphHistory(`Graph of interest`);
      };
    }
    this._db.getGraphOfInterest(
      dbIds,
      ignoredTypes,
      lengthLimit,
      isDirected,
      type,
      filter,
      idFilter,
      fn
    );
  }

  getCommonStream(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    dir: Neo4jEdgeDirection,
    type: DbResponseType,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x: any) => void
  ) {
    let fn = cb;
    if (type == DbResponseType.table) {
      fn = (x) => {
        cb(x);
        this._g.add2GraphHistory(`Common target/regulator`);
      };
    }
    this._db.getCommonStream(
      dbIds,
      ignoredTypes,
      lengthLimit,
      dir,
      type,
      filter,
      idFilter,
      fn
    );
  }

  getNeighborhood(
    dbIds: (string | number)[],
    ignoredTypes: string[],
    lengthLimit: number,
    isDirected: boolean,
    filter: TableFiltering,
    idFilter: (string | number)[],
    cb: (x: any) => void
  ) {
    let fn = (x: any) => {
      cb(x);
      this._g.add2GraphHistory(`Common target/regulator`);
    };
    this._db.getNeighborhood(
      dbIds,
      ignoredTypes,
      lengthLimit,
      isDirected,
      filter,
      idFilter,
      fn
    );
  }

  getGFAdata2ImportGFA(GFAData: GFAData, cb: () => void) {
    this._g.add2GraphHistory(`Import GFA`);
    this._db.importGFA(GFAData, cb);
  }

  clearData(cb: () => void) {
    this._g.add2GraphHistory(`Clear Data`);
    this._db.clearData(cb);
  }
}
