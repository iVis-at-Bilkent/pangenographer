import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";
import { TableFiltering } from "../../shared/table-view/table-view-types";
import {
  CQL_QUERY_CHANGE_MARKER,
  GENERIC_TYPE,
  PATH_WALK_NAME_DISALLOWED_REGEX,
} from "../constants";
import { GlobalVariableService } from "../global-variable.service";
import {
  ClassBasedRules,
  Rule,
  RuleNode,
} from "../operation-tabs/map-tab/query-types";
import {
  DbQueryMeta,
  DbResponse,
  DbResponseType,
  DbService,
  GFAData,
  GFAPathEdge,
  GFAWalkEdge,
  GraphResponse,
  Neo4jEdgeDirection,
  TableResponse,
} from "./data-types";

@Injectable({
  providedIn: "root",
})
export class Neo4jDb implements DbService {
  constructor(
    protected _http: HttpClient,
    protected _g: GlobalVariableService
  ) {}

  runQuery(
    query: string,
    callback: (x: any) => any,
    responseType: DbResponseType = 0,
    isTimeboxed = true
  ) {
    const conf = environment.dbConfig;
    const url = conf.getSampleUrl;
    const username = conf.username;
    const password = conf.password;
    const requestType = responseType == DbResponseType.graph ? "graph" : "row";
    this._g.setLoadingStatus(true);
    const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;

    // If the query is timeboxed, wrap it in a CALL apoc.cypher.run() procedure to allow for timeout
    // Otherwise, execute the query directly
    const q = isTimeboxed
      ? `CALL apoc.cypher.run("${query}", null) YIELD value RETURN value`
      : query;
    console.log(q);
    this._g.statusMsg.next("Executing database query...");
    const requestBody = {
      statements: [
        {
          statement: q,
          parameters: null,
          resultDataContents: [requestType],
        },
      ],
    };
    let isTimeout = true;
    let timeoutId: any = null;
    if (isTimeboxed) {
      timeoutId = setTimeout(() => {
        isTimeout = true;
        this._g.showErrorModal(
          "Database Timeout",
          "Your query took too long! <br> Consider adjusting timeout setting."
        );
      }, timeout);
    }

    const errFn = (err: any) => {
      if (isTimeout) {
        clearTimeout(timeoutId); // Clear the timeout if the request has already timed out
      }
      isTimeout = false;
      // Handle errors
      if (err.message.includes("Timeout occurred! It takes longer than")) {
        this._g.statusMsg.next(
          "Timeout occurred! It takes longer than expected! See the error message for more details."
        );
        this._g.showErrorModal(
          "Database Timeout",
          "Your query took too long!  <br> Consider adjusting timeout setting."
        );
      } else {
        this._g.statusMsg.next("Database query execution raised an error!");
        this._g.showErrorModal("Database Query Execution Error", err.message);
      }
      this._g.setLoadingStatus(false);
    };
    this._http
      .post(url, requestBody, {
        headers: {
          Accept: "application/json; charset=UTF-8",
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(username + ":" + password),
        },
      })
      .subscribe((x) => {
        if (isTimeout) {
          clearTimeout(timeoutId); // Clear the timeout if the request completed before the timeout
        }
        isTimeout = false;
        this._g.setLoadingStatus(false);
        if (x["errors"] && x["errors"].length > 0) {
          errFn(x["errors"][0]);
          return;
        }

        this._g.statusMsg.next(
          "The database query has been executed successfully!"
        );

        if (responseType == DbResponseType.graph) {
          callback(this.extractGraph(x));
        } else if (
          responseType == DbResponseType.table ||
          responseType == DbResponseType.count
        ) {
          callback(this.extractTable(x, isTimeboxed));
        } else if (responseType == DbResponseType.generic) {
          callback(this.extractGenericData(x, isTimeboxed));
        }
        this._g.refreshCues();
      }, errFn);
  }

  runQueryPromised(
    query: string,
    responseType: DbResponseType = 0,
    isTimeboxed = true
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const conf = environment.dbConfig;
      const url = conf.getSampleUrl;
      const username = conf.username;
      const password = conf.password;
      const requestType =
        responseType == DbResponseType.graph ? "graph" : "row";
      this._g.setLoadingStatus(true);
      const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;

      // If the query is timeboxed, wrap it in a CALL apoc.cypher.run() procedure to allow for timeout
      // Otherwise, execute the query directly
      const q = isTimeboxed
        ? `CALL apoc.cypher.run("${query}", null) YIELD value RETURN value`
        : query;
      console.log(q);

      this._g.statusMsg.next("Executing database query...");
      const requestBody = {
        statements: [
          {
            statement: q,
            parameters: null,
            resultDataContents: [requestType],
          },
        ],
      };

      let isTimeout = true;
      let timeoutId: any = null;

      if (isTimeboxed) {
        timeoutId = setTimeout(() => {
          isTimeout = true;
          this._g.showErrorModal(
            "Database Timeout",
            "Your query took too long! <br> Consider adjusting timeout setting."
          );
          reject(new Error("Database Timeout"));
        }, timeout);
      }

      const errFn = (err: any) => {
        if (isTimeout) {
          clearTimeout(timeoutId); // Clear the timeout if the request has already timed out
        }

        isTimeout = false;

        // Handle errors
        if (err.message.includes("Timeout occurred! It takes longer than")) {
          this._g.statusMsg.next(
            "Timeout occurred! It takes longer than expected! See the error message for more details."
          );
          this._g.showErrorModal(
            "Database Timeout",
            "Your query took too long!  <br> Consider adjusting timeout setting."
          );
        } else {
          this._g.statusMsg.next("Database query execution raised an error!");
          this._g.showErrorModal("Database Query Execution Error", err.message);
        }

        this._g.setLoadingStatus(false);
        reject(err);
      };

      this._http
        .post(url, requestBody, {
          headers: {
            Accept: "application/json; charset=UTF-8",
            "Content-Type": "application/json",
            Authorization: "Basic " + btoa(username + ":" + password),
          },
        })
        .toPromise()
        .then((x: any) => {
          if (isTimeout) {
            clearTimeout(timeoutId); // Clear the timeout if the request completed before the timeout
          }

          isTimeout = false;
          this._g.setLoadingStatus(false);

          if (x["errors"] && x["errors"].length > 0) {
            errFn(x["errors"][0]);
            return;
          }

          this._g.statusMsg.next(
            "The database query has been executed successfully!"
          );

          let result: any = null;

          if (responseType == DbResponseType.graph) {
            result = this.extractGraph(x);
          } else if (
            responseType == DbResponseType.table ||
            responseType == DbResponseType.count
          ) {
            result = this.extractTable(x, isTimeboxed);
          } else if (responseType == DbResponseType.generic) {
            result = this.extractGenericData(x, isTimeboxed);
          }

          this._g.refreshCues();
          resolve(result);
        })
        .catch((err) => {
          errFn(err);
          reject(err);
        });
    });
  }

  getNeighbors(
    elementIds: string[] | number[],
    callback: (x: GraphResponse) => any,
    meta?: DbQueryMeta
  ) {
    let isEdgeQuery = meta && meta.isEdgeQuery;
    const idFilter = this.buildIdFilter(elementIds, false, isEdgeQuery);
    let edgeCql = "";
    if (
      meta &&
      meta.edgeType != undefined &&
      typeof meta.edgeType == "string" &&
      meta.edgeType.length > 0
    ) {
      edgeCql = `-[e:${meta.edgeType}`;
    } else if (
      meta &&
      meta.edgeType != undefined &&
      typeof meta.edgeType == "object"
    ) {
      if (meta.isMultiLength) {
        for (let i = 0; i < meta.edgeType.length; i++) {
          if (i != meta.edgeType.length - 1) {
            edgeCql += `-[e${i}:${meta.edgeType[i]}]-()`;
          } else {
            edgeCql += `-[e${i}:${meta.edgeType[i]}`;
          }
        }
      } else {
        edgeCql = `-[e:${meta.edgeType.join("|")}`;
      }
    } else {
      edgeCql = `-[e`;
    }
    let targetCql = "";
    if (meta && meta.targetType != undefined && meta.targetType.length > 0) {
      targetCql = ":" + meta.targetType;
    }
    edgeCql += "]-";

    this.runQuery(
      `MATCH p=(n)${edgeCql}(${targetCql}) WHERE ${idFilter} RETURN p`,
      callback
    );
  }

  // Gets a path is a sequence of nodes and relationships that connect two nodes up to a certain length and direction in a graph.
  getElementsUpToCertainDistance(
    nodeIds: string[],
    distance: number,
    callback: (x: GraphResponse) => any,
    isUp: boolean // if undefined, it is a bidirectional query
  ) {
    // Get all paths for given nodes

    // Check type of nodeIds, if it is a string, convert it to an array of string
    if (typeof nodeIds === "string") {
      nodeIds = [nodeIds];
    }

    let queries = nodeIds.length
      ? nodeIds.map((nodeId) => {
          let query = `
          MATCH (startNode)
          WHERE elementId(startNode) = '${nodeId}' 
          MATCH path = (startNode)`;

          if (isUp) {
            query += "<";
          }

          query += `-[*1..${distance}]-`;

          if (!isUp) {
            query += ">";
          }

          query +=
            "(endNode) RETURN '${nodeId}' AS nodeId, nodes(path) AS nodes, relationships(path) AS relationships";

          return query;
        })
      : [];

    // If isUp is undefined, add a query for the reverse direction as well
    if (isUp === undefined) {
      queries = queries.concat(
        nodeIds.length
          ? nodeIds.map((nodeId) => {
              let query = `
              MATCH (startNode)
              WHERE elementId(startNode) = '${nodeId}' 
              MATCH path = (startNode)`;

              query += "<"; // Reverse direction

              query += `-[*1..${distance}]-`;

              query +=
                "(endNode) RETURN '${nodeId}' AS nodeId, nodes(path) AS nodes, relationships(path) AS relationships";

              return query;
            })
          : []
      );
    }

    // Combine all queries with UNION ALL
    let combinedQuery = queries.join(" UNION ALL ");

    this.runQuery(combinedQuery, callback);
  }

  getElements(
    ids: string[] | number[],
    callback: (x: GraphResponse) => any,
    meta: DbQueryMeta
  ) {
    const isEdgeQuery = meta && meta.isEdgeQuery;
    const idFilter = this.buildIdFilter(ids, false, isEdgeQuery);
    let edgepart = isEdgeQuery ? "-[e]-(n2)" : "";
    let returnPart = isEdgeQuery ? "n,e,n2" : "n";
    this.runQuery(
      `MATCH (n)${edgepart} WHERE ${idFilter} RETURN ${returnPart}`,
      callback
    );
  }

  getConsecutiveNodes(
    properties: (string | number)[],
    propertyType: string,
    objectType: string,
    callback: (x: GraphResponse) => any
  ) {
    let q = "MATCH ";
    properties.forEach((x, i) => {
      if (i != properties.length - 1) {
        q += `(n${i}:${objectType} {${propertyType}: '${x}'})-[e${i}]-`;
      } else {
        q += `(n${i}:${objectType} {${propertyType}: '${x}'}) RETURN `;
      }
    });
    properties.forEach((x, i) => {
      if (i != properties.length - 1) {
        q += `n${i}, e${i}, `;
      } else {
        q += `n${i}`;
      }
    });
    this.runQuery(q, callback);
  }

  getFilteringResult(
    rules: ClassBasedRules,
    filter: TableFiltering,
    skip: number,
    limit: number,
    type: DbResponseType,
    callback: (x: GraphResponse | TableResponse) => any
  ) {
    const cql = this.rule2cql2(rules, skip, limit, type, filter);
    this.runQuery(cql, callback, DbResponseType.generic);
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
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPreferences.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currentPage = filter.skip
      ? Math.floor(filter.skip / pageSize) + 1
      : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.map((element) => `'${element}'`).join()}]`;
    }

    this.runQuery(
      `CALL graphOfInterest([${dbIds
        .map((element) => `'${element}'`)
        .join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${isDirected},
      ${pageSize}, ${currentPage}, '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, {}, 0, 0, 0, ${timeout}, ${idf})`,
      callback,
      type,
      false
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
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPreferences.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currentPage = filter.skip
      ? Math.floor(filter.skip / pageSize) + 1
      : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.map((element) => `'${element}'`).join()}]`;
    }
    if (type == DbResponseType.count) {
      this.runQuery(
        `CALL commonStreamCount([${dbIds
          .map((element) => `'${element}'`)
          .join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${dir}, '${t}', ${isIgnoreCase}, {}, 0, 0, 0, ${timeout}, ${idf})`,
        callback,
        type,
        false
      );
    } else if (type == DbResponseType.table) {
      this.runQuery(
        `CALL commonStream([${dbIds
          .map((element) => `'${element}'`)
          .join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${dir}, ${pageSize}, ${currentPage},
       '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, {}, 0, 0, 0, ${timeout}, ${idf})`,
        callback,
        type,
        false
      );
    }
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
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPreferences.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currentPage = filter.skip
      ? Math.floor(filter.skip / pageSize) + 1
      : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.map((element) => `'${element}'`).join()}]`;
    }
    const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;
    this.runQuery(
      `CALL neighborhood([${dbIds
        .map((element) => `'${element}'`)
        .join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${isDirected},
      ${pageSize}, ${currentPage}, '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, {}, 0, 0, 0, ${timeout}, ${idf})`,
      callback,
      DbResponseType.table,
      false
    );
  }

  private getPageSize4Backend(): number {
    let pageSize = this._g.userPreferences.dataPageSize.getValue();
    if (this._g.userPreferences.queryResultPagination.getValue() == "Client") {
      pageSize = pageSize * this._g.userPreferences.dataPageLimit.getValue();
    }
    return pageSize;
  }

  private extractGraph(response: any): GraphResponse {
    let nodes = [];
    let edges = [];

    const results = response.results[0];
    if (!results) {
      this._g.showErrorModal("Invalid Query", response.errors[0]);
      return;
    }

    const data = response.results[0].data;
    for (let i = 0; i < data.length; i++) {
      const graph = data[i].graph;
      const graph_nodes = graph.nodes;
      const graph_edges = graph.relationships;

      for (let node of graph_nodes) {
        nodes.push(node);
      }

      for (let edge of graph_edges) {
        edges.push(edge);
      }
    }

    return { nodes: nodes, edges: edges };
  }

  private extractTable(response: any, isTimeboxed = true): TableResponse {
    if (response.errors && response.errors.length > 0) {
      this._g.showErrorModal("Database Query", response.errors);
      this._g.setLoadingStatus(false);
      return;
    }
    if (isTimeboxed) {
      const object = response.results[0].data;
      if (object[0] === undefined || object[0] === null) {
        return { columns: [], data: [] };
      }
      const cols = Object.keys(object[0].row[0]);
      const data = object.map((x: any) => Object.values(x.row[0]));
      // put id to first
      const idxId = cols.indexOf("ElementId(x)");
      if (idxId > -1) {
        const tmp = cols[idxId];
        cols[idxId] = cols[0];
        cols[0] = tmp;

        for (let i = 0; i < data.length; i++) {
          const tmp2 = data[i][idxId];
          data[i][idxId] = data[i][0];
          data[i][0] = tmp2;
        }
      }
      return { columns: cols, data: data };
    }
    return {
      columns: response.results[0].columns,
      data: response.results[0].data.map((x: any) => x.row),
    };
  }

  private extractGenericData(response: any, isTimeboxed = true): DbResponse {
    if (response.errors && response.errors.length > 0) {
      this._g.showErrorModal("Database Query", response.errors);
      this._g.setLoadingStatus(false);
      return;
    }
    if (isTimeboxed) {
      const object = response.results[0].data[0].row[0];
      const r: DbResponse = {
        tableData: { columns: ["elementId(x)", "x"], data: [] },
        graphData: { nodes: [], edges: [] },
        count: object.count,
      };
      // response is a node response
      if (object.nodeIds) {
        r.tableData.data = object.nodeIds.map((x: any, i: number) => [
          x,
          object.nodes[i],
        ]);
        r.graphData.nodes = object.nodeIds.map((x: any, i: number) => {
          return {
            properties: object.nodes[i],
            labels: object.nodeTypes[i],
            elementId: x,
          };
        });
      } else {
        r.tableData.data = object.edgeIds.map((x: any, i: number) => [
          x,
          object.edges[i],
        ]);
        r.graphData.nodes = r.graphData.nodes.concat(
          object.srcNodeIds.map((x: any, i: number) => {
            return {
              properties: object.srcNodes[i],
              labels: object.srcNodeTypes[i],
              elementId: x,
            };
          })
        );
        r.graphData.nodes = r.graphData.nodes.concat(
          object.tgtNodeIds.map((x: any, i: number) => {
            return {
              properties: object.tgtNodes[i],
              labels: object.tgtNodeTypes[i],
              elementId: x,
            };
          })
        );
        r.graphData.edges = object.edgeIds.map((x: any, i: number) => {
          return {
            properties: object.edges[i],
            type: object.edgeTypes[i],
            elementId: x,
            startNodeElementId: object.srcNodeIds[i],
            endNodeElementId: object.tgtNodeIds[i],
          };
        });
      }

      return r;
    }
    // return { columns: response.results[0].columns, data: response.results[0].data.map(x => x.row) };
    return null;
  }

  // Import GFA data to the database by converting it to CQL
  importGFA(GFAData: GFAData, callback: () => void) {
    this.runQuery(this.GFAdata2CQL(GFAData), callback, 0, false); // 0 is for generic response type, false is for isTimeboxed
  }

  // Import GFA data to the database by converting it to CQL and return a promise
  importGFAPromised(GFAData: GFAData): Promise<any> {
    return this.runQueryPromised(this.GFAdata2CQL(GFAData), 0, false);
  }

  // Clear the database
  clearDatabase(callback: () => void) {
    this.runQuery(
      `
      MATCH (n) 
      DETACH 
      DELETE n
    `,
      callback,
      0,
      false
    );
  }

  // Get sample data up to 150 nodes and edges
  getSampleData(callback: (x: GraphResponse) => any) {
    let query = `
      MATCH (n:SEGMENT)-[e]-()
      RETURN n,e limit ${this._g.userPreferences.sizeOfGetSampleData.getValue()}`;
    this.runQuery(query, callback);
  }

  // Get some zero degree nodes
  getSomeZeroDegreeNodes(callback: (x: GraphResponse) => any) {
    // This works incrementally, so add the zero degree nodes brought before and current seed source target count
    let toGetCount =
      this._g.userPreferences.seedSourceTargetCount.getValue() +
      this._g.someZeroDegreeNodesCount.getValue();

    // Update the count of zero degree nodes to get
    this._g.someZeroDegreeNodesCount.next(toGetCount);

    let query = `
      CALL {
        MATCH (source: SEGMENT)
        WHERE NOT (source)<-[]-()
        RETURN source AS node, 'source' AS type
        UNION
        MATCH (target: SEGMENT)
        WHERE NOT (target)-[]->()
        RETURN target AS node, 'target' AS type
      }
      RETURN node, type
      LIMIT ${toGetCount}`;
    this.runQuery(query, callback);
  }

  // Get all nodes with zero degree
  getAllZeroDegreeNodes(callback: (x: GraphResponse) => any) {
    const query = `
      MATCH (source: SEGMENT)
      WHERE NOT (source)<-[]-()
      RETURN source AS node, 'source' AS type
      UNION
      MATCH (target: SEGMENT)
      WHERE NOT (target)-[]->()
      RETURN target AS node, 'target' AS type
    `;
    this.runQuery(query, callback);
  }

  // Get all nodes with zero incoming degree
  getAllZeroIncomingDegreeNodes(callback: (x: GraphResponse) => any) {
    const query = `
      MATCH (n: SEGMENT) 
      WHERE NOT (n)<-[]-() 
      RETURN n
    `;
    this.runQuery(query, callback);
  }

  // Get all nodes with zero outgoing degree
  getAllZeroOutgoingDegreeNodes(callback: (x: GraphResponse) => any) {
    const query = `
      MATCH (n: SEGMENT) 
      WHERE NOT (n)-[]->() 
      RETURN n
    `;
    this.runQuery(query, callback);
  }

  // ------------------------------------------------- methods for conversion to CQL -------------------------------------------------
  private rule2cql2(
    rules: ClassBasedRules,
    skip: number,
    limit: number,
    type: DbResponseType,
    filter: TableFiltering = null
  ) {
    let query = "";
    query += this.getCql4Rules2(rules, filter);
    query += this.generateFinalQueryBlock(
      filter,
      skip,
      limit,
      type,
      rules.isEdge
    );
    return query;
  }

  private getCql4Rules2(rule: ClassBasedRules, filter: TableFiltering = null) {
    let isGenericType = false;
    if (
      rule.className == GENERIC_TYPE.ANY_CLASS ||
      rule.className == GENERIC_TYPE.EDGES_CLASS ||
      rule.className == GENERIC_TYPE.NODES_CLASS
    ) {
      isGenericType = true;
    }
    let classFilter = ":" + rule.className;
    if (isGenericType) {
      classFilter = "";
    }
    let matchClause: string;
    if (rule.isEdge) {
      let s =
        this._g.appDescription.getValue().relations[rule.className].source;
      let t =
        this._g.appDescription.getValue().relations[rule.className].target;
      let conn = ">";
      let isBidirectional =
        this._g.appDescription.getValue().relations[rule.className]
          .isBidirectional;
      if (isBidirectional) {
        conn = "";
      }
      matchClause = `OPTIONAL MATCH (:${s})-[x${classFilter}]-${conn}(:${t})\n`;
    } else {
      matchClause = `OPTIONAL MATCH (x${classFilter})\n`;
    }

    let conditions = this.getCondtion4RuleNode(rule.rules);

    if (filter != null && filter.txt.length > 0) {
      let s = this.getCondition4TxtFilter(
        rule.isEdge,
        rule.className,
        filter.txt
      );
      conditions = "(" + conditions + ") AND " + s;
    }

    return matchClause + "WHERE " + conditions + "\n";
  }

  private getCondition4TxtFilter(
    isEdge: boolean,
    className: string,
    txt: string
  ): string {
    let s = "";
    let t = "nodes";
    if (isEdge) {
      t = "edges";
    }

    let p = this._g.dataModel.getValue()[t][className];
    for (let k in p) {
      if (p[k] !== "list") {
        if (this._g.userPreferences.isIgnoreCaseInText.getValue()) {
          s += ` LOWER(toString(x.${k})) CONTAINS LOWER('${txt}') OR `;
        } else {
          s += ` toString(x.${k}) CONTAINS '${txt}' OR `;
        }
      } else {
        if (this._g.userPreferences.isIgnoreCaseInText.getValue()) {
          s += ` LOWER(REDUCE(s='', w IN x.${k} | s + w)) CONTAINS LOWER('${txt}') OR `;
        } else {
          s += ` REDUCE(s = '', w IN x.${k} | s + w) CONTAINS '${txt}' OR `;
        }
      }
    }
    s = s.slice(0, -3);
    s = "(" + s + ")";
    return s;
  }

  private getCondtion4RuleNode(node: RuleNode): string {
    let s = "(";
    if (!node.r.ruleOperator) {
      s += " " + this.getCondition4Rule(node.r) + " ";
    } else {
      for (let i = 0; i < node.children.length; i++) {
        if (i != node.children.length - 1) {
          s +=
            " " +
            this.getCondtion4RuleNode(node.children[i]) +
            " " +
            node.r.ruleOperator;
        } else {
          s += " " + this.getCondtion4RuleNode(node.children[i]) + " ";
        }
      }
    }
    return s + ")";
  }

  private getCondition4Rule(rule: Rule): string {
    if (
      !rule.propertyOperand ||
      rule.propertyOperand == GENERIC_TYPE.NOT_SELECTED
    ) {
      return "(TRUE)";
    }
    let inputOp = "";
    if (
      rule.propertyType == "string" ||
      rule.propertyType == "list" ||
      rule.propertyType.startsWith("enum")
    ) {
      inputOp = `'${rule.rawInput}'`;
    } else {
      inputOp = "" + rule.rawInput;
    }
    if (rule.propertyType == "list") {
      return `(${inputOp} IN x.${rule.propertyOperand})`;
    } else if (rule.propertyType == "edge") {
      if (
        !rule.operator ||
        !rule.inputOperand ||
        rule.inputOperand.length < 1
      ) {
        return `( size((x)-[:${rule.propertyOperand}]-()) > 0 )`;
      }
      const i = this.transformInp(rule, rule.inputOperand);
      const op = rule.operator != "One of" ? rule.operator : "IN";
      return `( size((x)-[:${rule.propertyOperand}]-()) ${op} ${i} )`;
    } else {
      if (
        rule.propertyType == "string" &&
        this._g.userPreferences.isIgnoreCaseInText.getValue()
      ) {
        inputOp = inputOp.toLowerCase();
        inputOp = this.transformInp(rule, inputOp);
        const op = rule.operator != "One of" ? rule.operator : "IN";
        return `(LOWER(x.${rule.propertyOperand}) ${op} ${inputOp})`;
      }
      inputOp = this.transformInp(rule, inputOp);
      const op = rule.operator != "One of" ? rule.operator : "IN";
      return `(x.${rule.propertyOperand} ${op} ${inputOp})`;
    }
  }

  private transformInp(rule: Rule, inputOp: string): string {
    if (rule.operator != "One of") {
      return inputOp;
    }
    let s = inputOp;
    s = s.replace(/'/g, "");
    if (rule.propertyType == "string") {
      let arr = s.split(",").map((x) => `'${x}'`);
      return `[${arr.join(",")}]`;
    } else {
      return `[${s}]`;
    }
  }

  private generateFinalQueryBlock(
    filter: TableFiltering,
    skip: number,
    limit: number,
    type: DbResponseType,
    isEdge: boolean
  ) {
    const r = `[${skip}..${skip + limit}]`;
    if (type == DbResponseType.table) {
      let orderExp = "";
      if (filter != null && filter.orderDirection.length > 0) {
        orderExp = `WITH x ORDER BY x.${filter.orderBy} ${filter.orderDirection}`;
      }
      if (isEdge) {
        return `${orderExp} RETURN collect(ElementId(x))${r} as edgeIds, collect(type(x))${r} as edgeTypes, collect(x)${r} as edges, 
        collect(ElementId(startNode(x)))${r} as srcNodeIds, collect(labels(startNode(x)))${r} as srcNodeTypes, collect(startNode(x))${r} as srcNodes,
        collect(ElementId(endNode(x)))${r} as tgtNodeIds, collect(labels(endNode(x)))${r} as tgtNodeTypes, collect(endNode(x))${r} as tgtNodes,
        size(collect(x)) as count`;
      }
      return `${orderExp} RETURN collect(ElementId(x))${r} as nodeIds, collect(labels(x))${r} as nodeTypes, collect(x)${r} as nodes, size(collect(x)) as count`;
    } else if (type == DbResponseType.count) {
      return `RETURN COUNT(x)`;
    }
    return "";
  }

  private buildIdFilter(
    ids: string[] | number[],
    hasAnd = false,
    isEdgeQuery = false
  ): string {
    if (ids === undefined) {
      return "";
    }
    let varName = "n";
    if (isEdgeQuery) {
      varName = "e";
    }
    let cql = "";
    if (ids.length > 0) {
      cql = "(";
    }
    for (let i = 0; i < ids.length; i++) {
      cql += `ElementId(${varName})='${ids[i]}' OR `;
    }

    if (ids.length > 0) {
      cql = cql.slice(0, -4);

      cql += ")";
      if (hasAnd) {
        cql += " AND ";
      }
    }
    return cql;
  }

  // This function converts the property name to a CQL compatible format
  // by replacing disallowed characters with their ASCII code
  private propertyName2CQL(propertyName: string): string {
    return propertyName.replace(PATH_WALK_NAME_DISALLOWED_REGEX, (match) => {
      return `${CQL_QUERY_CHANGE_MARKER}${match.charCodeAt(
        0
      )}${CQL_QUERY_CHANGE_MARKER}`;
    });
  }

  // This function converts the GFAPath/WalkEdge object to string
  private createEdgeKey(edge: GFAPathEdge | GFAWalkEdge): string {
    let key = "";

    // If the edge is path edge and has overlaps, add overlaps to the key
    if (edge.hasOwnProperty("overlap")) {
      edge = edge as GFAPathEdge;
      key += CQL_QUERY_CHANGE_MARKER + edge.overlap;
    }

    // Add the rest
    return (
      edge.source +
      CQL_QUERY_CHANGE_MARKER +
      edge.target +
      CQL_QUERY_CHANGE_MARKER +
      edge.sourceOrientation +
      CQL_QUERY_CHANGE_MARKER +
      edge.targetOrientation +
      key
    );
  }

  // This function converts the GFAData object to a CQL query
  private GFAdata2CQL(GFAData: GFAData): string {
    let query = "";
    let element2Create = "";

    // Creating new elements starts here

    // Initialize the query if there is edge or node to be created
    if (
      GFAData.paths.length ||
      GFAData.walks.length ||
      GFAData.segments.length ||
      GFAData.links.length ||
      GFAData.jumps.length ||
      GFAData.containments.length
    ) {
      query += "CREATE\n";
    }

    // creating path nodes
    GFAData.paths.forEach((path) => {
      // Convert the pathName to CQL as it may contain special characters
      path.pathName = this.propertyName2CQL(path.pathName);

      // Create the path node
      element2Create = `(p${path.pathName} :PATH {pathName: '${path.pathName}', segmentNames: '${path.segmentNames}'`;
      if (path.hasOwnProperty("overlaps")) {
        element2Create += `, overlaps: '${path.overlaps}'`;
      }
      element2Create += "}),\n";

      query += element2Create;
    });

    // creating walk nodes
    GFAData.walks.forEach((walk) => {
      // Convert the sampleIdentifier to CQL as it may contain special characters
      walk.sampleIdentifier = this.propertyName2CQL(walk.sampleIdentifier);

      // Create the walk node
      element2Create = `(w${walk.sampleIdentifier} :WALK {sampleIdentifier: '${walk.sampleIdentifier}', walk: '${walk.walk}'`;
      element2Create += `, haplotypeIndex: '${walk.haplotypeIndex}', sequenceIdentifier: '${walk.sequenceIdentifier}'`;
      if (walk.hasOwnProperty("sequenceStart")) {
        element2Create += `, sequenceStart: '${walk.sequenceStart}'`;
      }
      if (walk.hasOwnProperty("sequenceEnd")) {
        element2Create += `, sequenceEnd: '${walk.sequenceEnd}'`;
      }
      element2Create += "}),\n";

      query += element2Create;
    });

    // Get segments to be matched with the paths
    // This is used to add pathNames to the segments
    let segmentsToPathNamesMap = {};
    GFAData.pathSegments.forEach((pathSegment) => {
      if (!segmentsToPathNamesMap[`${pathSegment.segmentName}`]) {
        segmentsToPathNamesMap[`${pathSegment.segmentName}`] = [];
      }
      segmentsToPathNamesMap[`${pathSegment.segmentName}`].push(
        pathSegment.pathName
      );
    });

    // Get segments to be matched with the walks
    // This is used to add walkSampleIdentifiers to the segments
    let segmentsToWalkSampleIdentifiersMap = {};
    GFAData.walkSegments.forEach((walkSegment) => {
      if (!segmentsToWalkSampleIdentifiersMap[`${walkSegment.segmentName}`]) {
        segmentsToWalkSampleIdentifiersMap[`${walkSegment.segmentName}`] = [];
      }
      segmentsToWalkSampleIdentifiersMap[`${walkSegment.segmentName}`].push(
        walkSegment.sampleIdentifier
      );
    });

    // Create a segment map to store the segment objects given in GFAData.segments
    // This is used to avoid matching the same segment multiple times in the query
    // segmentName -> segment object given in GFAData.segments
    let segmentMap = {};

    // creating segment nodes
    GFAData.segments.forEach((segment) => {
      // Convert the segmentName to CQL as it may contain special characters
      segment.segmentName = this.propertyName2CQL(segment.segmentName);

      // Create the segment node
      element2Create = `(n${segment.segmentName} :SEGMENT {segmentData: '${segment.segmentData}', `;
      element2Create += `segmentName: '${segment.segmentName}', segmentLength: ${segment.segmentLength}`;
      if (segment.hasOwnProperty("readCount")) {
        element2Create += `, readCount: ${segment.readCount}`;
      }
      if (segment.hasOwnProperty("fragmentCount")) {
        element2Create += `, fragmentCount: ${segment.fragmentCount}`;
      }
      if (segment.hasOwnProperty("kmerCount")) {
        element2Create += `, kmerCount: ${segment.kmerCount}`;
      }
      if (segment.hasOwnProperty("SHA256Checksum")) {
        element2Create += `, SHA256Checksum: '${segment.SHA256Checksum}'`;
      }
      if (segment.hasOwnProperty("URIorLocalSystemPath")) {
        element2Create += `, URIorLocalSystemPath: '${segment.URIorLocalSystemPath}'`;
      }

      // Check if the segment is in the segmentsToPathNamesMap
      // If it is, add the pathNames to the segment
      if (segmentsToPathNamesMap[`${segment.segmentName}`]) {
        element2Create += ", pathNames: [";
        segmentsToPathNamesMap[`${segment.segmentName}`].forEach(
          (pathName: string) => {
            element2Create += `'${pathName}', `;
          }
        );

        // Remove the last comma and space and add the closing bracket
        element2Create =
          element2Create.substring(0, element2Create.length - 2) + "]";

        // Remove the segment from the segmentsToPathNamesMap to avoid adding the same pathNames multiple times
        delete segmentsToPathNamesMap[`${segment.segmentName}`];
      }
      // Initialize an empty array if there is no paths to match
      else {
        element2Create += ", pathNames: []";
      }

      // Check if the segment is in the segmentsToWalkSampleIdentifiersMap
      // If it is, add the walkSampleIdentifiers to the segment
      if (segmentsToWalkSampleIdentifiersMap[`${segment.segmentName}`]) {
        element2Create += ", walkSampleIdentifiers: [";
        segmentsToWalkSampleIdentifiersMap[`${segment.segmentName}`].forEach(
          (sampleIdentifier: string) => {
            element2Create += `'${sampleIdentifier}', `;
          }
        );

        // Remove the last comma and space and add the closing bracket
        element2Create =
          element2Create.substring(0, element2Create.length - 2) + "]";

        // Remove the segment from the segmentsToWalkSampleIdentifiersMap to avoid adding the same walkSampleIdentifiers multiple times
        delete segmentsToWalkSampleIdentifiersMap[`${segment.segmentName}`];
      }
      // Initialize an empty array if there is no walks to match
      else {
        element2Create += ", walkSampleIdentifiers: []";
      }

      // Add the segment to the query
      query += element2Create + "}),\n";

      // Add the segment to the segmentMap
      segmentMap[`${segment.segmentName}`] = segment;
    });

    // This is used to match from the databases the nodes that were created
    let segmentsToMatch = {};

    // Create link edges
    GFAData.links.forEach((link) => {
      // Convert the source and target property names to CQL as they may contain special characters
      link.source = this.propertyName2CQL(link.source);
      link.target = this.propertyName2CQL(link.target);

      // If the segment is not in the segmentMap, add it to the segmentsToMatch
      // This is used to match from the databases the nodes that were created
      if (segmentMap[`${link.source}`] === undefined) {
        segmentsToMatch[`${link.source}`] = true;
      }
      if (segmentMap[`${link.target}`] === undefined) {
        segmentsToMatch[`${link.target}`] = true;
      }

      // The edge creation
      element2Create = `(n${link.source})-[:LINK {sourceOrientation: '${link.sourceOrientation}', source: '${link.source}' , `;
      element2Create += `targetOrientation: '${link.targetOrientation}', target: '${link.target}'`;
      if (link.hasOwnProperty("overlap")) {
        element2Create += `, overlap: '${link.overlap}'`;
      }
      if (link.hasOwnProperty("mappingQuality")) {
        element2Create += `, mappingQuality: ${link.mappingQuality}`;
      }
      if (link.hasOwnProperty("numberOfMismatchesOrGaps")) {
        element2Create += `, numberOfMismatchesOrGaps: ${link.numberOfMismatchesOrGaps}`;
      }
      if (link.hasOwnProperty("readCount")) {
        element2Create += `, readCount: ${link.readCount}`;
      }
      if (link.hasOwnProperty("fragmentCount")) {
        element2Create += `, fragmentCount: ${link.fragmentCount}`;
      }
      if (link.hasOwnProperty("kmerCount")) {
        element2Create += `, kmerCount: ${link.kmerCount}`;
      }

      // Create a list of sample identifiers to add to the link edge
      element2Create += `, walkSampleIdentifiers: [`;

      // Create an array to hold added walkSampleIdentifiers to avoid adding the same sampleIdentifier multiple times
      // by removing the sampleIdentifier from the walkSampleIdentifiers
      let addedWalkEdges = [];

      // Add the sample identifier to the link edge if the edge is contained in walk
      // Loop through the GFAWalkEdges to find if there is link to match
      GFAData.walkEdges.forEach((walkEdge) => {
        if (
          walkEdge.source === link.source &&
          walkEdge.target === link.target &&
          walkEdge.sourceOrientation === link.sourceOrientation &&
          walkEdge.targetOrientation === link.targetOrientation
        ) {
          element2Create += `'${walkEdge.sampleIdentifier}', `;

          // Add the walkEdge to the addedWalkEdges
          addedWalkEdges.push(walkEdge);
        }
      });

      // Remove the last comma and space
      if (element2Create.endsWith(", ")) {
        element2Create = element2Create.substring(0, element2Create.length - 2);
      }

      // Close the walkSampleIdentifiers creation
      element2Create += `]`;

      // Create a list of path names to add to the link edge
      element2Create += `, pathNames: [`;

      // Create an array to hold added pathEdges to avoid adding the same pathName multiple times
      // by removing the pathEdge from the pathEdges
      let addedPathEdges = [];

      // Add the path names to the link edge if the edge is contained in path
      // Loop through the GFAPathEdges to find if there is link to match
      GFAData.pathEdges.forEach((pathEdge) => {
        if (
          pathEdge.source === link.source &&
          pathEdge.target === link.target &&
          pathEdge.sourceOrientation === link.sourceOrientation &&
          pathEdge.targetOrientation === link.targetOrientation &&
          !pathEdge.overlap
        ) {
          element2Create += `'${pathEdge.pathName}', `;

          // Add the pathEdge to the addedPathEdges
          addedPathEdges.push(pathEdge);
        }
      });

      // Remove the last comma and space
      if (element2Create.endsWith(", ")) {
        element2Create = element2Create.substring(0, element2Create.length - 2);
      }

      // Close the pathNames creation
      element2Create += `]`;

      // Close the edge creation
      element2Create += `}]->(n${link.target}),\n`;

      // Add the edge to the query
      query += element2Create;

      // Remove the added walkEdges from the GFAWalkEdges
      addedWalkEdges.forEach((walkEdge) => {
        GFAData.walkEdges.splice(GFAData.walkEdges.indexOf(walkEdge), 1);
      });

      // Remove the added pathEdges from the GFAPathEdges
      addedPathEdges.forEach((pathEdge) => {
        GFAData.pathEdges.splice(GFAData.pathEdges.indexOf(pathEdge), 1);
      });
    });

    // Create jump edges
    GFAData.jumps.forEach((jump) => {
      // Convert the source and target property names to CQL as they may contain special characters
      jump.source = this.propertyName2CQL(jump.source);
      jump.target = this.propertyName2CQL(jump.target);

      // The edge creation
      element2Create = `(n${jump.source})-[:JUMP {sourceOrientation: '${jump.sourceOrientation}', source: '${jump.source}', `;
      element2Create += `targetOrientation: '${jump.targetOrientation}', target: '${jump.target}', distance: '${jump.distance}'`;
      if (jump.hasOwnProperty("indirectShortcutConnections")) {
        element2Create += `, indirectShortcutConnections: ${jump.indirectShortcutConnections}`;
      }

      // Create a list of path names to add to the link edge
      element2Create += `, pathNames: [`;

      // Create an array to hold added pathEdges to avoid adding the same pathName multiple times
      // by removing the pathEdge from the pathEdges
      let addedPathEdges = [];

      // Add the path names to the link edge if the edge is contained in path
      // Loop through the GFAPathEdges to find if there is link to match
      GFAData.pathEdges.forEach((pathEdge) => {
        if (
          pathEdge.source === jump.source &&
          pathEdge.target === jump.target &&
          pathEdge.sourceOrientation === jump.sourceOrientation &&
          pathEdge.targetOrientation === jump.targetOrientation &&
          pathEdge.overlap === "J"
        ) {
          element2Create += `'${pathEdge.pathName}', `;

          // Add the pathEdge to the addedPathEdges
          addedPathEdges.push(pathEdge);
        }
      });

      // Remove the last comma and space
      if (element2Create.endsWith(", ")) {
        element2Create = element2Create.substring(0, element2Create.length - 2);
      }

      // Close the pathNames creation
      element2Create += `]`;

      // Close the edge creation
      element2Create += `}]->(n${jump.target}),\n`;

      // Add the edge to the query
      query += element2Create;

      // Remove the added pathEdges from the GFAPathEdges
      addedPathEdges.forEach((pathEdge) => {
        GFAData.pathEdges.splice(GFAData.pathEdges.indexOf(pathEdge), 1);
      });
    });

    // Create containment edges
    GFAData.containments.forEach((containment) => {
      // Convert the source and target property names to CQL as they may contain special characters
      containment.source = this.propertyName2CQL(containment.source);
      containment.target = this.propertyName2CQL(containment.target);

      // The edge creation
      element2Create = `(n${containment.source})-[:CONTAINMENT {sourceOrientation: '${containment.sourceOrientation}', `;
      element2Create += `source: '${containment.source}', targetOrientation: '${containment.targetOrientation}', `;
      element2Create += `target: '${containment.target}', overlap: '${containment.overlap}', pos: ${containment.pos}`;
      if (containment.hasOwnProperty("numberOfMismatchesOrGaps")) {
        element2Create += `, numberOfMismatchesOrGaps: ${containment.numberOfMismatchesOrGaps}`;
      }
      if (containment.hasOwnProperty("readCount")) {
        element2Create += `, readCount: ${containment.readCount}`;
      }

      // Close the edge creation
      element2Create += `}]->(n${containment.target}),\n`;

      // Add the edge to the query
      query += element2Create;
    });

    // Trim the last comma and newline if there are elements to create
    if (
      GFAData.paths.length ||
      GFAData.walks.length ||
      GFAData.segments.length ||
      GFAData.links.length ||
      GFAData.jumps.length ||
      GFAData.containments.length
    ) {
      query = query.substring(0, query.length - 2);
    }

    // Adding new properties to existing elements starts here

    // Extract the segment names of the segments to add pathNames and walkSampleIdentifiers
    let segmentNamesOfSegmentsToPathMap = Object.keys(segmentsToPathNamesMap);
    let segmentNamesOfSegmentsToWalkMap = Object.keys(
      segmentsToWalkSampleIdentifiersMap
    );

    // If there are segments to add pathNames or walkSampleIdentifiers
    if (
      segmentNamesOfSegmentsToPathMap.length ||
      segmentNamesOfSegmentsToWalkMap.length ||
      GFAData.pathEdges.length ||
      GFAData.walkEdges.length
    ) {
      // Add the SET clause to add the pathNames and walkSampleIdentifiers to the segments
      query += "\nSET\n";
    }

    // Add the pathNames to the segments
    segmentNamesOfSegmentsToPathMap.forEach((segmentName: string) => {
      query += `n${segmentName}.pathNames = n${segmentName}.pathNames + [`;
      segmentsToPathNamesMap[`${segmentName}`].forEach((pathName: string) => {
        query += `'${pathName}', `;
      });

      // Remove the last comma and space and add the closing bracket
      query = query.substring(0, query.length - 2) + "],\n";

      // Add the segment to the segmentToMatch map
      segmentsToMatch[`${segmentName}`] = true;
    });

    // Add the walkSampleIdentifiers to the segments
    segmentNamesOfSegmentsToWalkMap.forEach((segmentName: string) => {
      query += `n${segmentName}.walkSampleIdentifiers = n${segmentName}.walkSampleIdentifiers + [`;
      segmentsToWalkSampleIdentifiersMap[`${segmentName}`].forEach(
        (sampleIdentifier: string) => {
          query += `'${sampleIdentifier}', `;
        }
      );

      // Remove the last comma and space and add the closing bracket
      query = query.substring(0, query.length - 2) + "],\n";

      // Add the segment to the segmentToMatch map
      segmentsToMatch[`${segmentName}`] = true;
    });

    // Add the walkSampleIdentifiers to the edges

    // If there are two or more walk sample identifiers to add to the same edge,
    // create a map to store the walkSampleIdentifiers with the same edge key
    let edgesToWalkSampleIdentifiersMap = {};
    GFAData.walkEdges.forEach((walkEdge) => {
      // Create an unique key for the edge
      let edgeKey = this.createEdgeKey(walkEdge);

      // If the edge key is not in the map, create an empty array
      if (!edgesToWalkSampleIdentifiersMap[`${edgeKey}`]) {
        edgesToWalkSampleIdentifiersMap[`${edgeKey}`] = [];
      }
      // Add the walkSampleIdentifier to the map
      edgesToWalkSampleIdentifiersMap[`${edgeKey}`].push(
        walkEdge.sampleIdentifier
      );
    });

    // Add the walkSampleIdentifiers to the edges
    for (let edgeKey in edgesToWalkSampleIdentifiersMap) {
      // Add the walkSampleIdentifiers to the edge
      query += `e${edgeKey}.walkSampleIdentifiers = e${edgeKey}.walkSampleIdentifiers + [`;
      edgesToWalkSampleIdentifiersMap[`${edgeKey}`].forEach(
        (sampleIdentifier: string) => {
          query += `'${sampleIdentifier}', `;
        }
      );

      // Remove the last comma and space and add the closing bracket
      query = query.substring(0, query.length - 2) + "],\n";
    }

    // Add the pathNames to the edges

    // If there are two or more path names to add to the same edge,
    // create a map to store the pathNames with the same edge key
    let edgesToPathNamesMap = {};
    GFAData.pathEdges.forEach((pathEdge) => {
      // Create an unique key for the edge
      let edgeKey = this.createEdgeKey(pathEdge);

      // If the edge key is not in the map, create an empty array
      if (!edgesToPathNamesMap[`${edgeKey}`]) {
        edgesToPathNamesMap[`${edgeKey}`] = [];
      }
      // Add the pathName to the map
      edgesToPathNamesMap[`${edgeKey}`].push(pathEdge.pathName);
    });

    // Add the pathNames to the edges
    for (let edgeKey in edgesToPathNamesMap) {
      // Add the pathNames to the edge
      query += `e${edgeKey}.pathNames = e${edgeKey}.pathNames + [`;
      edgesToPathNamesMap[`${edgeKey}`].forEach((pathName: string) => {
        query += `'${pathName}', `;
      });

      // Remove the last comma and space and add the closing bracket
      query = query.substring(0, query.length - 2) + "],\n";
    }

    // Trim the last comma and newline
    if (
      segmentNamesOfSegmentsToPathMap.length ||
      segmentNamesOfSegmentsToWalkMap.length ||
      GFAData.pathEdges.length ||
      GFAData.walkEdges.length
    ) {
      query = query.substring(0, query.length - 2);
    }

    // Matching previosly created elements starts here

    // If there are edges to match
    let edgesToMatch = {};
    GFAData.pathEdges.forEach((pathEdge) => {
      // Create an unique key for the edge
      let edgeKey = this.createEdgeKey(pathEdge);

      // add the edge to edgesToMatch
      edgesToMatch[`${edgeKey}`] = true;
    });
    GFAData.walkEdges.forEach((walkEdge) => {
      // Create an unique key for the edge
      let edgeKey = this.createEdgeKey(walkEdge);

      // add the edge to edgesToMatch
      edgesToMatch[`${edgeKey}`] = true;
    });

    // If there are nodes to match, add the match clause to *** the beginning of the query ***
    if (
      Object.keys(segmentsToMatch).length > 0 ||
      Object.keys(edgesToMatch).length > 0
    ) {
      // First create the match clause
      let matchClause = "MATCH\n";

      // Add the segments to match
      for (let segmentName in segmentsToMatch) {
        matchClause += `(n${segmentName}:SEGMENT {segmentName: '${segmentName}'}),\n`;
      }

      // Add the edges to match
      for (let edgeKey in edgesToMatch) {
        let edge = edgeKey.split(CQL_QUERY_CHANGE_MARKER);

        // If the edge is a jump edge
        if (edge.length === 4) {
          matchClause += `()-[e${edgeKey}:JUMP {source: '${edge[0]}', target: '${edge[1]}', `;
          matchClause += `sourceOrientation: '${edge[2]}', targetOrientation: '${edge[3]}' }]->(),\n`;
        }
        // Else if the edge is a link edge
        else {
          // Add the match clause for the edge link
          matchClause += `()-[e${edgeKey}:LINK {source: '${edge[0]}', target: '${edge[1]}', `;
          matchClause += `sourceOrientation: '${edge[2]}', targetOrientation: '${edge[3]}' }]->(),\n`;
        }
      }

      // Add the match clause to the beginning of the query by removing the last comma and newline
      matchClause = matchClause.substring(0, matchClause.length - 2);
      query = matchClause + "\n" + query;
    }

    return query;
  }
}
