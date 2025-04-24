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
  // put preferred database service type as argument
  constructor(private _g: GlobalVariableService, private db: Neo4jDb) {
    this._db = db;
  }

  getNeighbors(
    elementId: string[],
    callback: (x: GraphResponse) => any,
    historyMeta?: HistoryMetaData,
    queryMeta?: DbQueryMeta
  ) {
    let s = "";
    if (historyMeta) {
      s = historyMeta.labels;
      if (!historyMeta.labels) {
        s = this._g.getLabels4Elements(elementId, historyMeta.isNode);
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
    this._db.getNeighbors(elementId, fn, queryMeta);
  }

  getElements(
    ids: string[],
    callback: (x: GraphResponse) => any,
    queryMeta: DbQueryMeta,
    historyMeta?: HistoryMetaData
  ) {
    let s = "";
    if (historyMeta) {
      s = historyMeta.labels;
      if (!historyMeta.labels) {
        s = this._g.getLabels4Elements(ids, historyMeta.isNode);
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
    this._db.getElements(ids, fn, queryMeta);
  }

  // Adapter function to get elements in a path up to certain distance from a node
  getElementsUpToCertainDistance(
    nodeIds: string[],
    distance: number,
    callback: (x: GraphResponse) => any,
    isUp: boolean
  ) {
    // Callback function to add history
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Show up/downstream");
    };

    // Call the database service function
    this._db.getElementsUpToCertainDistance(nodeIds, distance, fn, isUp);
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
    callback: (x: any) => void
  ) {
    let fn = callback;
    if (type == DbResponseType.table) {
      fn = (x) => {
        callback(x);
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
    callback: (x: any) => void
  ) {
    let fn = callback;
    if (type == DbResponseType.table) {
      fn = (x) => {
        callback(x);
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
    callback: (x: any) => void
  ) {
    let fn = (x: any) => {
      callback(x);
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

  sequenceChainSearch(
    sequences: string,
    maxJumpLength: number,
    minSubsequenceMatchLength: number,
    callback: (x: any) => void
  ) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Search by sequence chain");
    };
    this._db.sequenceChainSearch(
      sequences,
      maxJumpLength,
      minSubsequenceMatchLength,
      fn
    );
  }

  getGFAData2ImportGFAPromised(GFAData: GFAData): Promise<any> {
    this._g.add2GraphHistory("Import GFA");
    return this._db.importGFAPromised(GFAData);
  }

  clearDatabase(callback: () => void) {
    this._g.add2GraphHistory("Clear Database");
    this._db.clearDatabase(callback);
  }

  getSampleData(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get sample data");
    };
    this._db.getSampleData(fn);
  }

  getSomeZeroDegreeNodes(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get some nodes with zero degree");
    };
    this._db.getSomeZeroDegreeNodes(fn);
  }

  getAllZeroDegreeNodes(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get all nodes with zero degree");
    };
    this._db.getAllZeroDegreeNodes(fn);
  }

  getAllZeroIncomingDegreeNodes(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get all nodes with zero incoming degree");
    };
    this._db.getAllZeroIncomingDegreeNodes(fn);
  }

  getAllZeroOutgoingDegreeNodes(callback: (x: GraphResponse) => any) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get all nodes with zero outgoing degree");
    };
    this._db.getAllZeroOutgoingDegreeNodes(fn);
  }

  getSegmentsByNames(
    segmentNames: string[],
    callback: (x: GraphResponse) => any
  ) {
    let fn = (x: any) => {
      callback(x);
      this._g.add2GraphHistory("Get segments by names");
    };
    this._db.getSegmentsByNames(segmentNames, fn);
  }
}
