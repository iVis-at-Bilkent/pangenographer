import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { GlobalVariableService } from "../global-variable.service";
import {
  GraphResponse,
  TableResponse,
  DbService,
  DbQueryMeta,
  Neo4jEdgeDirection,
  DbResponse,
  DbResponseType,
} from "./data-types";
import {
  Rule,
  ClassBasedRules,
  RuleNode,
} from "../operation-tabs/map-tab/query-types";
import { GENERIC_TYPE, LONG_MAX, LONG_MIN } from "../constants";
import { TableFiltering } from "../../shared/table-view/table-view-types";
import { TimebarGraphInclusionTypes } from "../user-preference";
import { environment } from "src/environments/environment";

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
    const timeout = this._g.userPrefs.dbTimeout.getValue() * 1000;
    let q = `CALL apoc.cypher.runTimeboxed("${query}", {}, ${timeout}) YIELD value RETURN value`;
    if (!isTimeboxed) {
      q = query;
    }
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
    if (isTimeboxed) {
      setTimeout(() => {
        if (isTimeout) {
          this._g.showErrorModal(
            "Database Timeout",
            "Your query took too long! <br> Consider adjusting timeout setting."
          );
        }
      }, timeout);
    }

    const errFn = (err) => {
      isTimeout = false;
      // It means our user-defined stored procedure intentionally throws exception to signal timeout
      if (err.message.includes("Timeout occurred! It takes longer than")) {
        this._g.statusMsg.next("");
        this._g.showErrorModal(
          "Database Timeout",
          "Your query took too long!  <br> Consider adjusting timeout setting."
        );
      } else {
        this._g.statusMsg.next("Database query execution raised error!");
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
        isTimeout = false;
        this._g.setLoadingStatus(false);
        if (x["errors"] && x["errors"].length > 0) {
          errFn(x["errors"][0]);
          return;
        }
        this._g.statusMsg.next("");
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
      }, errFn);
  }

  getNeighbors(
    elemIds: string[] | number[],
    callback: (x: GraphResponse) => any,
    meta?: DbQueryMeta
  ) {
    let isEdgeQuery = meta && meta.isEdgeQuery;
    const idFilter = this.buildIdFilter(elemIds, false, isEdgeQuery);
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

    let f2 = this.dateFilterFromUserPref("n", true);
    if (meta && meta.isMultiLength) {
      for (let i = 0; i < meta.edgeType.length; i++) {
        f2 += this.dateFilterFromUserPref("e" + i, false);
      }
    } else {
      f2 += this.dateFilterFromUserPref("e", false);
    }

    this.runQuery(
      `MATCH p=(n)${edgeCql}(${targetCql}) WHERE ${idFilter} ${f2} RETURN p`,
      callback
    );
  }

  getElems(
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

  getSampleData(callback: (x: GraphResponse) => any) {
    const f1 = this.dateFilterFromUserPref("n", true);
    const f2 = this.dateFilterFromUserPref("e", false);
    let f = "";
    if (f1.length > 0) {
      f += " WHERE " + f1.substr(5);
    }
    if (f2.length > 0) {
      f += f2;
    }
    this.runQuery(`MATCH (n)-[e]-() ${f} RETURN n,e limit 100`, callback);
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
    cb: (x) => void
  ) {
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currPage = filter.skip ? Math.floor(filter.skip / pageSize) + 1 : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    const timeMap = this.getTimebarMapping4Java();
    let d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    let d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    if (!this._g.userPrefs.isLimitDbQueries2range.getValue()) {
      d1 = 0;
      d2 = 0;
    }
    const inclusionType = this._g.userPrefs.objectInclusionType.getValue();
    const timeout = this._g.userPrefs.dbTimeout.getValue() * 1000;
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.join()}]`;
    }
    this.runQuery(
      `CALL graphOfInterest([${dbIds.join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${isDirected},
      ${pageSize}, ${currPage}, '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, ${timeMap}, ${d1}, ${d2}, ${inclusionType}, ${timeout}, ${idf})`,
      cb,
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
    cb: (x) => void
  ) {
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currPage = filter.skip ? Math.floor(filter.skip / pageSize) + 1 : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    const inclusionType = this._g.userPrefs.objectInclusionType.getValue();
    const timeMap = this.getTimebarMapping4Java();
    let d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    let d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    if (!this._g.userPrefs.isLimitDbQueries2range.getValue()) {
      d1 = 0;
      d2 = 0;
    }
    const timeout = this._g.userPrefs.dbTimeout.getValue() * 1000;
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.join()}]`;
    }
    if (type == DbResponseType.count) {
      this.runQuery(
        `CALL commonStreamCount([${dbIds.join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${dir}, '${t}', ${isIgnoreCase},
       ${timeMap}, ${d1}, ${d2}, ${inclusionType}, ${timeout}, ${idf})`,
        cb,
        type,
        false
      );
    } else if (type == DbResponseType.table) {
      this.runQuery(
        `CALL commonStream([${dbIds.join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${dir}, ${pageSize}, ${currPage},
       '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, ${timeMap}, ${d1}, ${d2}, ${inclusionType}, ${timeout}, ${idf})`,
        cb,
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
    cb: (x) => void
  ) {
    const t = filter.txt ?? "";
    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();
    const pageSize = this.getPageSize4Backend();
    const currPage = filter.skip ? Math.floor(filter.skip / pageSize) + 1 : 1;
    const orderBy = filter.orderBy ? `'${filter.orderBy}'` : null;
    let orderDir = 0;
    if (filter.orderDirection == "desc") {
      orderDir = 1;
    } else if (filter.orderDirection == "") {
      orderDir = 2;
    }
    const timeMap = this.getTimebarMapping4Java();
    let d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    let d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    if (!this._g.userPrefs.isLimitDbQueries2range.getValue()) {
      d1 = 0;
      d2 = 0;
    }
    let idf = "null";
    if (idFilter) {
      idf = `[${idFilter.join()}]`;
    }
    const inclusionType = this._g.userPrefs.objectInclusionType.getValue();
    const timeout = this._g.userPrefs.dbTimeout.getValue() * 1000;
    this.runQuery(
      `CALL neighborhood([${dbIds.join()}], [${ignoredTypes.join()}], ${lengthLimit}, ${isDirected},
      ${pageSize}, ${currPage}, '${t}', ${isIgnoreCase}, ${orderBy}, ${orderDir}, ${timeMap}, ${d1}, ${d2}, ${inclusionType}, ${timeout}, ${idf})`,
      cb,
      DbResponseType.table,
      false
    );
  }

  private getPageSize4Backend(): number {
    let pageSize = this._g.userPrefs.dataPageSize.getValue();
    if (this._g.userPrefs.queryResultPagination.getValue() == "Client") {
      pageSize = pageSize * this._g.userPrefs.dataPageLimit.getValue();
    }
    return pageSize;
  }

  private getTimebarMapping4Java(): string {
    // {Person:["start_t", "end_t"]}
    const mapping = this._g.appDescription.getValue().timebarDataMapping;
    let s = "{";
    for (const k in mapping) {
      s +=
        k +
        ':["' +
        mapping[k].begin_datetime +
        '","' +
        mapping[k].end_datetime +
        '"],';
    }
    s = s.slice(0, -1);
    s += "}";
    return s;
  }

  private dateFilterFromUserPref(varName: string, isNode: boolean): string {
    if (!this._g.userPrefs.isLimitDbQueries2range.getValue()) {
      return "";
    }
    let s = "";
    let keys = [];

    if (isNode) {
      keys = Object.keys(this._g.appDescription.getValue().objects);
    } else {
      keys = Object.keys(this._g.appDescription.getValue().relations);
    }

    const d1 = this._g.userPrefs.dbQueryTimeRange.start.getValue();
    const d2 = this._g.userPrefs.dbQueryTimeRange.end.getValue();
    const inclusionType = this._g.userPrefs.objectInclusionType.getValue();
    const mapping = this._g.appDescription.getValue().timebarDataMapping;

    if (!mapping || Object.keys(mapping).length < 1) {
      return "";
    }

    s = " AND (";
    for (const k of keys) {
      if (!mapping[k]) {
        continue;
      }
      const p1 = `COALESCE(${varName}.${mapping[k].begin_datetime}, ${LONG_MIN})`;
      const p2 = `COALESCE(${varName}.${mapping[k].end_datetime}, ${LONG_MAX})`;
      const bothNull = `(${varName}.${mapping[k].end_datetime} IS NULL AND ${varName}.${mapping[k].begin_datetime} IS NULL)`;
      if (inclusionType == TimebarGraphInclusionTypes.overlaps) {
        s += `(${bothNull} OR (${p1} <= ${d2} AND ${p2} >= ${d1})) AND`;
      } else if (inclusionType == TimebarGraphInclusionTypes.contains) {
        s += `(${bothNull} OR (${d1} <= ${p1} AND ${d2} >= ${p2})) AND`;
      } else if (inclusionType == TimebarGraphInclusionTypes.contained_by) {
        s += `(${bothNull} OR (${p1} <= ${d1} AND ${p2} >= ${d2})) AND`;
      }
    }
    s = s.slice(0, -4);
    s += ")";
    return s;
  }

  private extractGraph(response): GraphResponse {
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

  private extractTable(response, isTimeboxed = true): TableResponse {
    if (response.errors && response.errors.length > 0) {
      this._g.showErrorModal("Database Query", response.errors);
      this._g.setLoadingStatus(false);
      return;
    }
    if (isTimeboxed) {
      const obj = response.results[0].data;
      if (obj[0] === undefined || obj[0] === null) {
        return { columns: [], data: [] };
      }
      const cols = Object.keys(obj[0].row[0]);
      const data = obj.map((x) => Object.values(x.row[0]));
      // put id to first
      const idxId = cols.indexOf("ID(x)");
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
      data: response.results[0].data.map((x) => x.row),
    };
  }

  private extractGenericData(response, isTimeboxed = true): DbResponse {
    if (response.errors && response.errors.length > 0) {
      this._g.showErrorModal("Database Query", response.errors);
      this._g.setLoadingStatus(false);
      return;
    }
    if (isTimeboxed) {
      const obj = response.results[0].data[0].row[0];
      const r: DbResponse = {
        tableData: { columns: ["ID(x)", "x"], data: [] },
        graphData: { nodes: [], edges: [] },
        count: obj.count,
      };
      // response is a node response
      if (obj.nodeIds) {
        r.tableData.data = obj.nodeIds.map((x, i) => [x, obj.nodes[i]]);
        r.graphData.nodes = obj.nodeIds.map((x, i) => {
          return { properties: obj.nodes[i], labels: obj.nodeTypes[i], id: x };
        });
      } else {
        r.tableData.data = obj.edgeIds.map((x, i) => [x, obj.edges[i]]);
        r.graphData.nodes = r.graphData.nodes.concat(
          obj.srcNodeIds.map((x, i) => {
            return {
              properties: obj.srcNodes[i],
              labels: obj.srcNodeTypes[i],
              id: x,
            };
          })
        );
        r.graphData.nodes = r.graphData.nodes.concat(
          obj.tgtNodeIds.map((x, i) => {
            return {
              properties: obj.tgtNodes[i],
              labels: obj.tgtNodeTypes[i],
              id: x,
            };
          })
        );
        r.graphData.edges = obj.edgeIds.map((x, i) => {
          return {
            properties: obj.edges[i],
            type: obj.edgeTypes[i],
            id: x,
            startNode: obj.srcNodeIds[i],
            endNode: obj.tgtNodeIds[i],
          };
        });
      }

      return r;
    }
    // return { columns: response.results[0].columns, data: response.results[0].data.map(x => x.row) };
    return null;
  }

  loadGFA(GFAdata: any) {
    var query = this.GFAdata2CQL(GFAdata);
    const conf = environment.dbConfig;
    const url = conf.loadGFADataUrl;
    const username = conf.username;
    const password = conf.password;
    this._g.setLoadingStatus(true);
    console.log(query);
    this._g.statusMsg.next("Executing database query...");
    const requestBody = {
      query: query,
    };
    const errFn = (err) => {
      this._g.statusMsg.next("Database query execution raised error!");
      this._g.showErrorModal("Database Query Execution Error", err.message);
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
        this._g.setLoadingStatus(false);
        if (x["errors"] && x["errors"].length > 0) {
          errFn(x["errors"][0]);
          return;
        }
        this._g.statusMsg.next("");
      }, errFn);
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
    conditions += this.dateFilterFromUserPref("x", !rule.isEdge);

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
        if (this._g.userPrefs.isIgnoreCaseInText.getValue()) {
          s += ` LOWER(toString(x.${k})) CONTAINS LOWER('${txt}') OR `;
        } else {
          s += ` toString(x.${k}) CONTAINS '${txt}' OR `;
        }
      } else {
        if (this._g.userPrefs.isIgnoreCaseInText.getValue()) {
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
        this._g.userPrefs.isIgnoreCaseInText.getValue()
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
        return `${orderExp} RETURN collect(ID(x))${r} as edgeIds, collect(type(x))${r} as edgeTypes, collect(x)${r} as edges, 
        collect(ID(startNode(x)))${r} as srcNodeIds, collect(labels(startNode(x)))${r} as srcNodeTypes, collect(startNode(x))${r} as srcNodes,
        collect(ID(endNode(x)))${r} as tgtNodeIds, collect(labels(endNode(x)))${r} as tgtNodeTypes, collect(endNode(x))${r} as tgtNodes,
        size(collect(x)) as count`;
      }
      return `${orderExp} RETURN collect(ID(x))${r} as nodeIds, collect(labels(x))${r} as nodeTypes, collect(x)${r} as nodes, size(collect(x)) as count`;
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
      cql += `ID(${varName})=${ids[i]} OR `;
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

  private GFAdata2CQL(gfaJSON: any) {
    const curGfaJson = {
      nodes: gfaJSON.nodes,
      edges: gfaJSON.edges,
    };

    var query = "CREATE\n";
    curGfaJson.nodes.forEach((node) => {
      var node2Create = `(n${node.data.segmentName} :Segment {segmentData: 
        '${node.data.segmentData}', segmentName: '${node.data.segmentName}'
        , segmentLength: ${node.data.segmentLength}`;
      if (node.data.hasOwnProperty("readCount")) {
        node2Create += `, readCount: ${node.data.readCount}`;
      }
      if (node.data.hasOwnProperty("fragmentCount")) {
        node2Create += `, fragmentCount: ${node.data.fragmentCount}`;
      }
      if (node.data.hasOwnProperty("kmerCount")) {
        node2Create += `, kmerCount: ${node.data.kmerCount}`;
      }
      if (node.data.hasOwnProperty("SHA256Checksum")) {
        node2Create += `, SHA256Checksum: '${node.data.SHA256Checksum}'`;
      }
      if (node.data.hasOwnProperty("URIorLocalSystemPath")) {
        node2Create += `, URIorLocalSystemPath: '${node.data.URIorLocalSystemPath}'`;
      }
      query += node2Create + "}),\n";
    });

    query = query.substring(0, query.length - 2) + "\nCREATE\n";

    curGfaJson.edges.forEach((edge) => {
      var edge2Create = `(n${edge.data.source})-[:${edge.classes}
        {sourceOrientation: ${edge.data.sourceOrientation}, source: '${edge.data.source}'
        , targetOrientation: ${edge.data.targetOrientation}, target: '${edge.data.target}'`;
      if (edge.data.hasOwnProperty("overlap")) {
        edge2Create += `, overlap: '${edge.data.overlap}'`;
      }
      if (edge.data.hasOwnProperty("pos")) {
        edge2Create += `, pos: ${edge.data.pos}`;
      }
      if (edge.data.hasOwnProperty("distance")) {
        edge2Create += `, distance: '${edge.data.distance}'`;
      }
      if (edge.data.hasOwnProperty("mappingQuality")) {
        edge2Create += `, mappingQuality: ${edge.data.mappingQuality}`;
      }
      if (edge.data.hasOwnProperty("numberOfMismatchesOrGaps")) {
        edge2Create += `, numberOfMismatchesOrGaps: ${edge.data.numberOfMismatchesOrGaps}`;
      }
      if (edge.data.hasOwnProperty("readCount")) {
        edge2Create += `, readCount: ${edge.data.readCount}`;
      }
      if (edge.data.hasOwnProperty("fragmentCount")) {
        edge2Create += `, fragmentCount: ${edge.data.fragmentCount}`;
      }
      if (edge.data.hasOwnProperty("kmerCount")) {
        edge2Create += `, kmerCount: ${edge.data.kmerCount}`;
      }
      if (edge.data.hasOwnProperty("indirectShortcutConnections")) {
        edge2Create += `, indirectShortcutConnections: ${edge.data.indirectShortcutConnections}`;
      }
      edge2Create += `}]->(n${edge.data.target}),\n`;
      query += edge2Create;
    });

    query = query.substring(0, query.length - 2);
    return query;
  }

  // ------------------------------------------------- end of methods for conversion to CQL -------------------------------------------------
}
