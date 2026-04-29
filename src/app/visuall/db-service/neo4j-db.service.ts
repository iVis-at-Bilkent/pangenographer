import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";
import { TableFiltering } from "../../shared/table-view/table-view-types";
import {
  CQL_QUERY_CHANGE_MARKER,
  CYPHER_WRITE_QUERY_TYPES,
  GENERIC_TYPE,
  IMPORT_BATCH_SIZE,
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
  GraphResponse,
  Neo4jEdgeDirection,
  TableResponse,
} from "./data-types";

@Injectable({
  providedIn: "root",
})
export class Neo4jDb implements DbService {
  // Set after the segment_name_idx index is first ensured in this session so
  // subsequent streamed import chunks skip the redundant schema round-trip.
  private _segmentIndexEnsured = false;

  constructor(
    protected _http: HttpClient,
    protected _g: GlobalVariableService,
  ) {}

  runQuery(
    query: string,
    callback: (response: any) => any,
    responseType: DbResponseType = 0,
    isTimeboxed = true,
  ) {
    if (
      this._g.sampleDatabaseIndex.getValue() &&
      (query.includes(CYPHER_WRITE_QUERY_TYPES[0]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[1]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[2]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[3]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[4]))
    ) {
      this._g.showErrorModal(
        "Invalid Query",
        "Write operation is not allowed in this environment!",
      );
      return;
    }

    const conf = environment.dbConfig;
    const url = conf.urls[this._g.sampleDatabaseIndex.getValue()];
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
          "Your query took too long! <br> Consider adjusting timeout setting.",
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
        this._g.statusMessage.next(
          "Timeout occurred! It takes longer than expected! See the error message for more details.",
        );
        this._g.showErrorModal(
          "Database Timeout",
          "Your query took too long!  <br> Consider adjusting timeout setting.",
        );
      } else {
        this._g.statusMessage.next("Database query execution raised an error!");
        this._g.showErrorModal("Database Query Execution Error", err.message);
      }
      this._g.setLoadingStatus(false);
    };

    this._http
      .post<{
      errors?: { message: string }[];
      }>(url, requestBody, {
      headers: {
        Accept: "application/json; charset=UTF-8",
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(username + ":" + password),
      },
      })
      .subscribe({
      next: (response: {
        errors?: { message: string }[];
        [key: string]: unknown;
      }): void => {
        if (isTimeout) {
        clearTimeout(timeoutId); // Clear the timeout if the request completed before the timeout
        }

        isTimeout = false;
        this._g.setLoadingStatus(false);
        if (response["errors"] && response["errors"].length > 0) {
        errFn(response["errors"][0]);
        return;
        }

        if (responseType == DbResponseType.graph) {
        callback(this.extractGraph(response));
        } else if (
        responseType == DbResponseType.table ||
        responseType == DbResponseType.count
        ) {
        callback(this.extractTable(response, isTimeboxed));
        } else if (responseType == DbResponseType.generic) {
        callback(this.extractGenericData(response, isTimeboxed));
        }
      },
      error: (err: unknown): void => {
        errFn(err);
      },
      complete: (): void => {
        this._g.refreshCuesBadges();
      },
      });
  }

  runQueryPromised(
    query: string,
    responseType: DbResponseType = 0,
    isTimeboxed = true,
    parameters: any = null,
  ): Promise<any> {
    if (
      this._g.sampleDatabaseIndex.getValue() &&
      (query.includes(CYPHER_WRITE_QUERY_TYPES[0]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[1]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[2]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[3]) ||
        query.includes(CYPHER_WRITE_QUERY_TYPES[4]))
    ) {
      this._g.showErrorModal(
        "Invalid Query",
        "Write operation is not allowed in this environment!",
      );
      return;
    }

    return new Promise((resolve, reject) => {
      const conf = environment.dbConfig;
      const url = conf.urls[this._g.sampleDatabaseIndex.getValue()];
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

      let isTimeout = true;
      let timeoutId: any = null;

      if (isTimeboxed) {
        timeoutId = setTimeout(() => {
          isTimeout = true;
          this._g.showErrorModal(
            "Database Timeout",
            "Your query took too long! <br> Consider adjusting timeout setting.",
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
          this._g.statusMessage.next(
            "Timeout occurred! It takes longer than expected! See the error message for more details.",
          );
          this._g.showErrorModal(
            "Database Timeout",
            "Your query took too long!  <br> Consider adjusting timeout setting.",
          );
        } else {
          this._g.statusMessage.next(
            "Database query execution raised an error!",
          );
          this._g.showErrorModal("Database Query Execution Error", err.message);
        }

        this._g.setLoadingStatus(false);
        reject(err);
      };

      interface Neo4jHttpError {
        message: string;
      }

      interface Neo4jHttpStatementRequest {
        statement: string;
        parameters: Record<string, unknown> | null;
        resultDataContents: Array<"graph" | "row">;
      }

      interface Neo4jHttpRequestBody {
        statements: Neo4jHttpStatementRequest[];
      }

      interface Neo4jHttpResult {
        data?: unknown[];
      }

      interface Neo4jHttpResponse {
        errors?: Neo4jHttpError[];
        results?: Neo4jHttpResult[];
      }

      const requestBody: Neo4jHttpRequestBody = {
        statements: [
          {
        statement: q,
        parameters: parameters,
        resultDataContents: [requestType],
          },
        ],
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
        .then((response: Neo4jHttpResponse) => {
          if (isTimeout) {
        clearTimeout(timeoutId); // Clear the timeout if the request completed before the timeout
          }

          isTimeout = false;
          this._g.setLoadingStatus(false);

          if (response["errors"] && response["errors"].length > 0) {
        errFn(response["errors"][0]);
        return;
          }

          let result: GraphResponse | TableResponse | DbResponse | null = null;

          if (responseType == DbResponseType.graph) {
        result = this.extractGraph(response);
          } else if (
        responseType == DbResponseType.table ||
        responseType == DbResponseType.count
          ) {
        result = this.extractTable(response, isTimeboxed);
          } else if (responseType == DbResponseType.generic) {
        result = this.extractGenericData(response, isTimeboxed);
          }

          this._g.refreshCuesBadges();
          resolve(result);
        })
        .catch((err: unknown) => {
          errFn(err);
          reject(err);
        });
    });
  }

  getNeighbors(
    elementIds: string[] | number[],
    callback: (response: GraphResponse) => any,
    meta?: DbQueryMeta,
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
      callback,
    );
  }

  // Gets a path is a sequence of nodes and relationships that connect two nodes up to a certain length and direction in a graph.
  getElementsUpToCertainDistance(
    nodeIds: string[],
    distance: number,
    callback: (response: GraphResponse) => any,
    isUp: boolean, // if undefined, it is a bidirectional query
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

          query += `(endNode) RETURN '${nodeId}' AS nodeId, nodes(path) AS nodes, relationships(path) AS relationships`;

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

              query += "<";

              query += `-[*1..${distance}]-`;

              query += `(endNode) RETURN '${nodeId}' AS nodeId, nodes(path) AS nodes, relationships(path) AS relationships`;

              return query;
            })
          : [],
      );
    }

    // Combine all queries with UNION ALL
    let combinedQuery = queries.join(" UNION ALL ");

    this.runQuery(combinedQuery, callback);
  }

  getElements(
    ids: string[] | number[],
    callback: (response: GraphResponse) => any,
    meta: DbQueryMeta,
  ) {
    const isEdgeQuery = meta && meta.isEdgeQuery;
    const idFilter = this.buildIdFilter(ids, false, isEdgeQuery);
    let edgePart = isEdgeQuery ? "-[e]-(n2)" : "";
    let returnPart = isEdgeQuery ? "n,e,n2" : "n";
    this.runQuery(
      `MATCH (n)${edgePart} WHERE ${idFilter} RETURN ${returnPart}`,
      callback,
    );
  }

  getConsecutiveNodes(
    properties: (string | number)[],
    propertyType: string,
    objectType: string,
    callback: (response: GraphResponse) => any,
  ) {
    let q = "MATCH ";

    properties.forEach((property, i) => {
      if (i != properties.length - 1) {
        q += `(n${i}:${objectType} {${propertyType}: '${property}'})-[e${i}]-`;
      } else {
        q += `(n${i}:${objectType} {${propertyType}: '${property}'}) RETURN `;
      }
    });

    properties.forEach((property, i) => {
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
    callback: (response: GraphResponse | TableResponse) => any,
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
    callback: (response: any) => void,
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
      false,
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
    callback: (response: any) => void,
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
        false,
      );
    } else if (type == DbResponseType.table) {
      this.runQuery(
        `CALL commonStream([${dbIds
          .map((element) => `'${element}'`)
          .join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${dir}, ${pageSize}, ${currentPage},
        '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, {}, 0, 0, 0, ${timeout}, ${idf})`,
        callback,
        type,
        false,
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
    callback: (response: any) => void,
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
      false,
    );
  }

  sequenceChainSearch(
    sequences: string,
    maxJumpLength: number,
    minSubsequenceMatchLength: number,
    callback: (response: any) => void,
  ) {
    const timeout = this._g.userPreferences.dbTimeout.getValue() * 1000;
    const pageSize = this.getPageSize4Backend();
    const currentPage = 1;

    this.runQuery(
      `CALL sequenceChainSearch([${sequences}], ${maxJumpLength}, ${minSubsequenceMatchLength}, [], ${pageSize}, ${currentPage}, ${timeout}) 
       YIELD nodes, nodeClass, nodeElementId, edges, edgeClass, edgeElementId, edgeSourceTargets, paths, indices
       RETURN nodes, nodeClass, nodeElementId, edges, edgeClass, edgeElementId, edgeSourceTargets, paths, indices`,
      callback,
      DbResponseType.table,
      false,
    );
  }

  private getPageSize4Backend(): number {
    let pageSize = this._g.userPreferences.queryResultPageSize.getValue();
    if (this._g.userPreferences.queryResultPagination.getValue() == "Client") {
      pageSize = pageSize * this._g.userPreferences.dataPageLimit.getValue();
    }
    return pageSize;
  }

  private extractGraph(response: any): GraphResponse {
    let nodes = [];
    let edges = [];
    const nodeIds = new Set();

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
        if (!nodeIds.has(node.id)) {
          nodes.push(node);
          nodeIds.add(node.id);
        }
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
      const responseData = response.results[0].data;

      // If the object is empty, return empty columns and data
      if (responseData[0] === undefined || responseData[0] === null) {
        return { columns: [], data: [] };
      }

      const columns = Object.keys(responseData[0].row[0]); // Get the column headers
      // Get the data rows as an array of arrays and concatenate the meta data to the data
      const data = responseData.map((x: any) => {
        const mergedObject = Object.assign(
          {},
          Object.values(x.row[0])[0],
          Object.values(x.meta)[0],
        );
        return mergedObject;
      });

      // Get the index of the id column
      const idIndex = columns.indexOf("ElementId(x)");

      // If id is found, put it to the first column
      if (idIndex > -1) {
        const temp = columns[idIndex];
        columns[idIndex] = columns[0];
        columns[0] = temp;

        for (let i = 0; i < data.length; i++) {
          const temp2 = data[i][idIndex];
          data[i][idIndex] = data[i][0];
          data[i][0] = temp2;
        }
      }

      // Return the column headers and rows as data
      return { columns: columns, data: data };
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
          }),
        );
        r.graphData.nodes = r.graphData.nodes.concat(
          object.tgtNodeIds.map((x: any, i: number) => {
            return {
              properties: object.tgtNodes[i],
              labels: object.tgtNodeTypes[i],
              elementId: x,
            };
          }),
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

  // Import a GFA data chunk into Neo4j using parameterized UNWIND batches.
  // Mirrors the pipeline in tools/import_gfa_to_neo4j.py. CREATE nodes/edges
  // with empty membership arrays, then MATCH+SET APPEND path/walk membership
  // so references that cross streamed chunks still attach to their targets.
  async importGFAPromised(GFAData: GFAData): Promise<any> {
    this.encodeGFANamesInPlace(GFAData);
    const leftoverSegmentData = this.mergeSegmentsData(GFAData);
    this.initMembershipArrays(GFAData);

    await this.ensureSegmentIndex();

    await this.runBatched(
      "UNWIND $batch AS row CREATE (p:PATH) SET p = row",
      GFAData.paths,
    );
    await this.runBatched(
      "UNWIND $batch AS row CREATE (w:WALK) SET w = row",
      GFAData.walks,
    );
    await this.runBatched(
      "UNWIND $batch AS row CREATE (s:SEGMENT) SET s = row",
      GFAData.segments,
    );

    // segmentsData whose segment was created in an earlier streamed chunk.
    if (leftoverSegmentData.length) {
      await this.runBatched(
        `UNWIND $batch AS row
         MATCH (s:SEGMENT {segmentName: row.segmentName})
         SET s.segmentData = s.segmentData + row.segmentData`,
        leftoverSegmentData,
      );
    }

    await this.runBatched(
      `UNWIND $batch AS row
       MATCH (src:SEGMENT {segmentName: row.source})
       MATCH (tgt:SEGMENT {segmentName: row.target})
       CREATE (src)-[e:LINK]->(tgt) SET e = row`,
      GFAData.links,
    );
    await this.runBatched(
      `UNWIND $batch AS row
       MATCH (src:SEGMENT {segmentName: row.source})
       MATCH (tgt:SEGMENT {segmentName: row.target})
       CREATE (src)-[e:JUMP]->(tgt) SET e = row`,
      GFAData.jumps,
    );
    await this.runBatched(
      `UNWIND $batch AS row
       MATCH (src:SEGMENT {segmentName: row.source})
       MATCH (tgt:SEGMENT {segmentName: row.target})
       CREATE (src)-[e:CONTAINMENT]->(tgt) SET e = row`,
      GFAData.containments,
    );

    // Append path/walk membership arrays. Pre-aggregate by target so each
    // segment/edge is hit once per chunk, and MATCH so references from this
    // chunk to entities created in earlier chunks still attach.
    const segPathBatch = this.aggregateBySegment(
      GFAData.pathSegments,
      "pathName",
    );
    const segWalkBatch = this.aggregateBySegment(
      GFAData.walkSegments,
      "sampleIdentifier",
    );
    const edgePathBatch = this.aggregateByEdge(GFAData.pathEdges, "pathName");
    const linkWalkBatch = this.aggregateByEdge(
      GFAData.walkEdges,
      "sampleIdentifier",
    );

    // coalesce(..., []) is required: in Cypher `null + [x]` evaluates to null,
    // and SET x = null deletes the property, so without coalesce a segment
    // whose membership array wasn't initialized would end up with no property.
    if (segPathBatch.length) {
      await this.runBatched(
        `UNWIND $batch AS row
         MATCH (s:SEGMENT {segmentName: row.segmentName})
         SET s.pathNames = coalesce(s.pathNames, []) + row.values`,
        segPathBatch,
      );
    }
    if (segWalkBatch.length) {
      await this.runBatched(
        `UNWIND $batch AS row
         MATCH (s:SEGMENT {segmentName: row.segmentName})
         SET s.walkSampleIdentifiers = coalesce(s.walkSampleIdentifiers, []) + row.values`,
        segWalkBatch,
      );
    }
    if (edgePathBatch.length) {
      // pathEdges may correspond to either a LINK or a JUMP, so match both.
      await this.runBatched(
        `UNWIND $batch AS row
         MATCH (:SEGMENT {segmentName: row.source})-[e]->(:SEGMENT {segmentName: row.target})
         WHERE (type(e) = 'LINK' OR type(e) = 'JUMP')
           AND e.sourceOrientation = row.sourceOrientation
           AND e.targetOrientation = row.targetOrientation
         SET e.pathNames = coalesce(e.pathNames, []) + row.values`,
        edgePathBatch,
      );
    }
    if (linkWalkBatch.length) {
      await this.runBatched(
        `UNWIND $batch AS row
         MATCH (:SEGMENT {segmentName: row.source})-[e:LINK]->(:SEGMENT {segmentName: row.target})
         WHERE e.sourceOrientation = row.sourceOrientation
           AND e.targetOrientation = row.targetOrientation
         SET e.walkSampleIdentifiers = coalesce(e.walkSampleIdentifiers, []) + row.values`,
        linkWalkBatch,
      );
    }
  }

  private async ensureSegmentIndex(): Promise<void> {
    if (this._segmentIndexEnsured) return;
    await this.runQueryPromised(
      "CREATE INDEX segment_name_idx IF NOT EXISTS FOR (n:SEGMENT) ON (n.segmentName)",
      DbResponseType.graph,
      false,
    );
    this._segmentIndexEnsured = true;
  }

  private async runBatched(query: string, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    for (let i = 0; i < items.length; i += IMPORT_BATCH_SIZE) {
      const batch = items.slice(i, i + IMPORT_BATCH_SIZE);
      await this.runQueryPromised(query, DbResponseType.graph, false, {
        batch,
      });
    }
  }

  // Run propertyName2CQL over every name-like field the import writes.
  private encodeGFANamesInPlace(d: GFAData): void {
    for (const s of d.segments) {
      s.segmentName = this.propertyName2CQL(s.segmentName);
      s.id = s.segmentName;
    }
    for (const sd of d.segmentsData) {
      sd.segmentName = this.propertyName2CQL(sd.segmentName);
    }
    for (const p of d.paths) {
      p.pathName = this.propertyName2CQL(p.pathName);
    }
    for (const w of d.walks) {
      w.sampleIdentifier = this.propertyName2CQL(w.sampleIdentifier);
    }
    for (const l of d.links) {
      l.source = this.propertyName2CQL(l.source);
      l.target = this.propertyName2CQL(l.target);
    }
    for (const j of d.jumps) {
      j.source = this.propertyName2CQL(j.source);
      j.target = this.propertyName2CQL(j.target);
    }
    for (const c of d.containments) {
      c.source = this.propertyName2CQL(c.source);
      c.target = this.propertyName2CQL(c.target);
    }
    for (const ps of d.pathSegments) {
      ps.pathName = this.propertyName2CQL(ps.pathName);
      ps.segmentName = this.propertyName2CQL(ps.segmentName);
    }
    for (const pe of d.pathEdges) {
      pe.pathName = this.propertyName2CQL(pe.pathName);
      pe.source = this.propertyName2CQL(pe.source);
      pe.target = this.propertyName2CQL(pe.target);
    }
    for (const ws of d.walkSegments) {
      ws.sampleIdentifier = this.propertyName2CQL(ws.sampleIdentifier);
      ws.segmentName = this.propertyName2CQL(ws.segmentName);
    }
    for (const we of d.walkEdges) {
      we.sampleIdentifier = this.propertyName2CQL(we.sampleIdentifier);
      we.source = this.propertyName2CQL(we.source);
      we.target = this.propertyName2CQL(we.target);
    }
  }

  // Fold segmentsData into the matching segment when possible (so the segment
  // is CREATEd with its full sequence) and return the rest to be appended via
  // MATCH+SET against segments from earlier chunks.
  private mergeSegmentsData(
    d: GFAData,
  ): { segmentName: string; segmentData: string }[] {
    if (!d.segmentsData || d.segmentsData.length === 0) return [];
    const extras: { [name: string]: string } = {};
    for (const sd of d.segmentsData) {
      extras[sd.segmentName] = (extras[sd.segmentName] ?? "") + sd.segmentData;
    }
    for (const s of d.segments) {
      const extra = extras[s.segmentName];
      if (extra !== undefined) {
        s.segmentData = (s.segmentData ?? "") + extra;
        delete extras[s.segmentName];
      }
    }
    d.segmentsData = [];
    return Object.entries(extras).map(([segmentName, segmentData]) => ({
      segmentName,
      segmentData,
    }));
  }

  // Initialize empty membership arrays on every node/edge being CREATE-d so
  // downstream MATCH+SET appends can rely on the property existing, and so
  // the frontend never sees a missing field.
  private initMembershipArrays(d: GFAData): void {
    for (const s of d.segments) {
      s.pathNames = [];
      s.walkSampleIdentifiers = [];
    }
    for (const l of d.links) {
      l.pathNames = [];
      l.walkSampleIdentifiers = [];
    }
    for (const j of d.jumps) {
      j.pathNames = [];
      j.walkSampleIdentifiers = [];
    }
    for (const c of d.containments) {
      c.pathNames = [];
      c.walkSampleIdentifiers = [];
    }
  }

  // Group {segmentName, valueKey} rows into {segmentName, values[]} batches so
  // each segment is touched at most once per chunk when appending memberships.
  private aggregateBySegment<T extends { segmentName: string }>(
    items: T[],
    valueKey: keyof T,
  ): { segmentName: string; values: string[] }[] {
    const map: { [k: string]: string[] } = {};
    for (const item of items) {
      (map[item.segmentName] ??= []).push(item[valueKey] as unknown as string);
    }
    return Object.entries(map).map(([segmentName, values]) => ({
      segmentName,
      values,
    }));
  }

  // Group edge-like rows (source/target/orientations + valueKey) into batches
  // keyed by the edge identity so each edge is touched at most once per chunk.
  private aggregateByEdge<
    T extends {
      source: string;
      target: string;
      sourceOrientation: string;
      targetOrientation: string;
    },
  >(
    items: T[],
    valueKey: keyof T,
  ): {
    source: string;
    target: string;
    sourceOrientation: string;
    targetOrientation: string;
    values: string[];
  }[] {
    const map: {
      [k: string]: {
        source: string;
        target: string;
        sourceOrientation: string;
        targetOrientation: string;
        values: string[];
      };
    } = {};
    for (const item of items) {
      const key = `${item.source}\u0000${item.target}\u0000${item.sourceOrientation}\u0000${item.targetOrientation}`;
      if (!map[key]) {
        map[key] = {
          source: item.source,
          target: item.target,
          sourceOrientation: item.sourceOrientation,
          targetOrientation: item.targetOrientation,
          values: [],
        };
      }
      map[key].values.push(item[valueKey] as unknown as string);
    }
    return Object.values(map);
  }

  // Clear the database
  clearDatabase(callback: () => void) {
    this.runQuery(`MATCH (n) DETACH DELETE n`, callback, 1, false);
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

  // Get given segment names from the database
  getSegmentsByNames(
    segmentNames: string[],
    callback: (response: GraphResponse) => any,
  ) {
    let query = `
      OPTIONAL MATCH (n:SEGMENT)
      WHERE n.segmentName IN [${segmentNames.map((x) => `'${x}'`).join(", ")}]
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
    filter: TableFiltering | null = null,
  ) {
    let query = "";
    query += this.getCql4Rules2(rules, filter);
    query += this.generateFinalQueryBlock(
      filter,
      skip,
      limit,
      type,
      rules.isEdge,
    );
    return query;
  }

  private getCql4Rules2(
    rule: ClassBasedRules,
    filter: TableFiltering | null = null,
  ) {
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

    let conditions = this.getCondition4RuleNode(rule.rules);

    if (filter != null && filter.txt.length > 0) {
      let s = this.getCondition4TxtFilter(
        rule.isEdge,
        rule.className,
        filter.txt,
      );
      conditions = "(" + conditions + ") AND " + s;
    }

    return matchClause + "WHERE " + conditions + "\n";
  }

  private getCondition4TxtFilter(
    isEdge: boolean,
    className: string,
    txt: string,
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

  private getCondition4RuleNode(node: RuleNode): string {
    let s = "(";
    if (!node.r.ruleOperator) {
      s += " " + this.getCondition4Rule(node.r) + " ";
    } else {
      for (let i = 0; i < node.children.length; i++) {
        if (i != node.children.length - 1) {
          s +=
            " " +
            this.getCondition4RuleNode(node.children[i]) +
            " " +
            node.r.ruleOperator;
        } else {
          s += " " + this.getCondition4RuleNode(node.children[i]) + " ";
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
    filter: TableFiltering | null,
    skip: number,
    limit: number,
    type: DbResponseType,
    isEdge: boolean,
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
    isEdgeQuery = false,
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
        0,
      )}${CQL_QUERY_CHANGE_MARKER}`;
    });
  }
}
