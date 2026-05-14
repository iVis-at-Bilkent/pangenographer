import { Injectable } from "@angular/core";
import {
  DbResponseType,
  GraphResponse,
  Neo4jEdgeDirection,
  TableResponse,
} from "./db-service/data-types";
import { Neo4jDb } from "./db-service/neo4j-db.service";
import { CytoscapeService } from "./cytoscape.service";
import { GlobalVariableService } from "./global-variable.service";

export type BenchmarkCaseKey =
  | "database-summary"
  | "top-degree"
  | "cypher-edge-sample"
  | "cypher-neighborhood"
  | "pg2-neighborhood"
  | "pg2-graph-of-interest"
  | "pg2-common-stream";

export interface BenchmarkCaseDefinition {
  key: BenchmarkCaseKey;
  label: string;
  rendersGraph: boolean;
}

export const BENCHMARK_CASES: BenchmarkCaseDefinition[] = [
  {
    key: "database-summary",
    label: "Cypher: database summary",
    rendersGraph: false,
  },
  {
    key: "top-degree",
    label: "Cypher: top degree segments",
    rendersGraph: false,
  },
  {
    key: "cypher-edge-sample",
    label: "Cypher: edge sample render",
    rendersGraph: true,
  },
  {
    key: "cypher-neighborhood",
    label: "Cypher: seed neighborhood render",
    rendersGraph: true,
  },
  {
    key: "pg2-neighborhood",
    label: "PG2 procedure: neighborhood",
    rendersGraph: true,
  },
  {
    key: "pg2-graph-of-interest",
    label: "PG2 procedure: graph of interest",
    rendersGraph: true,
  },
  {
    key: "pg2-common-stream",
    label: "PG2 procedure: common stream",
    rendersGraph: true,
  },
];

export interface BenchmarkOptions {
  warmupRuns: number;
  measuredRuns: number;
  graphLimits: number[];
  neighborhoodRadii: number[];
  procedurePageSize: number;
  cypherPathLimit: number;
  seedCount: number;
  seedSegmentNames: string[];
  selectedCases: BenchmarkCaseKey[];
  layoutTimeoutMs: number;
}

export interface BenchmarkRunResult {
  caseKey: BenchmarkCaseKey;
  caseLabel: string;
  params: string;
  runIndex: number;
  measured: boolean;
  status: "ok" | "error" | "cancelled";
  queryMs?: number;
  conversionMs?: number;
  renderSetupMs?: number;
  layoutQueueMs?: number;
  layoutMs?: number;
  totalMs?: number;
  rows?: number;
  nodes?: number;
  edges?: number;
  payloadKb?: number;
  browserHeapMb?: number;
  layoutTimedOut?: boolean;
  seedIds?: string;
  seedNames?: string;
  error?: string;
}

interface BenchmarkSeed {
  id: string;
  segmentName: string;
  degree?: number;
}

interface BuiltBenchmarkCase {
  key: BenchmarkCaseKey;
  label: string;
  params: string;
  responseType: DbResponseType;
  isTimeboxed: boolean;
  renderGraph: boolean;
  query: string;
  toGraph?: (response: any) => GraphResponse;
}

interface RenderTiming {
  renderSetupMs?: number;
  layoutQueueMs?: number;
  layoutMs?: number;
  totalMs?: number;
  layoutTimedOut?: boolean;
}

@Injectable({
  providedIn: "root",
})
export class BenchmarkService {
  private isCancelled = false;

  constructor(
    private _db: Neo4jDb,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
  ) {}

  getDefaultOptions(): BenchmarkOptions {
    return {
      warmupRuns: 1,
      measuredRuns: 5,
      graphLimits: [150, 500, 1000, 2500],
      neighborhoodRadii: [1, 2, 3],
      procedurePageSize: 2500,
      cypherPathLimit: 2500,
      seedCount: 2,
      seedSegmentNames: [],
      selectedCases: BENCHMARK_CASES.map((x) => x.key),
      layoutTimeoutMs: 180000,
    };
  }

  stop(): void {
    this.isCancelled = true;
  }

  async runSuite(
    options: BenchmarkOptions,
    onResult?: (result: BenchmarkRunResult) => void,
  ): Promise<BenchmarkRunResult[]> {
    this.isCancelled = false;
    const results: BenchmarkRunResult[] = [];
    const seeds = await this.resolveSeeds(options);
    const cases = this.buildCases(options, seeds);
    const totalRuns = options.warmupRuns + options.measuredRuns;

    for (const benchmarkCase of cases) {
      for (let i = 0; i < totalRuns; i++) {
        if (this.isCancelled) {
          const cancelled = this.createCancelledResult(benchmarkCase, i);
          results.push(cancelled);
          onResult?.(cancelled);
          return results;
        }

        const result = await this.runCase(
          benchmarkCase,
          i,
          i >= options.warmupRuns,
          seeds,
          options,
        );
        results.push(result);
        onResult?.(result);
      }
    }

    return results;
  }

  resultsToCsv(results: BenchmarkRunResult[]): string {
    const columns = [
      "caseKey",
      "caseLabel",
      "params",
      "runIndex",
      "measured",
      "status",
      "queryMs",
      "conversionMs",
      "renderSetupMs",
      "layoutQueueMs",
      "layoutMs",
      "totalMs",
      "rows",
      "nodes",
      "edges",
      "payloadKb",
      "browserHeapMb",
      "layoutTimedOut",
      "seedIds",
      "seedNames",
      "error",
    ];
    const lines = [columns.join(",")];
    for (const result of results) {
      lines.push(
        columns
          .map((column) => this.csvCell((result as any)[column]))
          .join(","),
      );
    }
    return lines.join("\n");
  }

  downloadCsv(results: BenchmarkRunResult[]): void {
    const csv = this.resultsToCsv(results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pg2-web-benchmark-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async runCase(
    benchmarkCase: BuiltBenchmarkCase,
    runIndex: number,
    measured: boolean,
    seeds: BenchmarkSeed[],
    options: BenchmarkOptions,
  ): Promise<BenchmarkRunResult> {
    const totalStart = performance.now();
    const baseResult: BenchmarkRunResult = {
      caseKey: benchmarkCase.key,
      caseLabel: benchmarkCase.label,
      params: benchmarkCase.params,
      runIndex,
      measured,
      status: "ok",
      seedIds: seeds.map((x) => x.id).join(";"),
      seedNames: seeds.map((x) => x.segmentName).join(";"),
    };

    try {
      const queryStart = performance.now();
      const response = await this._db.runQueryPromised(
        benchmarkCase.query,
        benchmarkCase.responseType,
        benchmarkCase.isTimeboxed,
      );
      baseResult.queryMs = performance.now() - queryStart;
      baseResult.payloadKb = this.payloadKb(response);

      let graph: GraphResponse | undefined;
      let rows: number | undefined;
      if (benchmarkCase.toGraph) {
        const conversionStart = performance.now();
        graph = benchmarkCase.toGraph(response);
        baseResult.conversionMs = performance.now() - conversionStart;
      } else if (benchmarkCase.responseType === DbResponseType.graph) {
        graph = response as GraphResponse;
      } else {
        rows = this.getTableRowCount(response as TableResponse);
      }

      if (graph) {
        baseResult.nodes = graph.nodes.length;
        baseResult.edges = graph.edges.length;
      }
      if (rows !== undefined) {
        baseResult.rows = rows;
      }

      if (benchmarkCase.renderGraph && graph && graph.nodes.length > 0) {
        const renderTiming = await this.renderGraph(graph, options);
        Object.assign(baseResult, renderTiming);
      }

      baseResult.browserHeapMb = this.browserHeapMb();
      baseResult.totalMs = performance.now() - totalStart;
      return baseResult;
    } catch (e) {
      baseResult.status = "error";
      baseResult.error = this.errorMessage(e);
      baseResult.totalMs = performance.now() - totalStart;
      baseResult.browserHeapMb = this.browserHeapMb();
      return baseResult;
    }
  }

  private createCancelledResult(
    benchmarkCase: BuiltBenchmarkCase,
    runIndex: number,
  ): BenchmarkRunResult {
    return {
      caseKey: benchmarkCase.key,
      caseLabel: benchmarkCase.label,
      params: benchmarkCase.params,
      runIndex,
      measured: false,
      status: "cancelled",
    };
  }

  private buildCases(
    options: BenchmarkOptions,
    seeds: BenchmarkSeed[],
  ): BuiltBenchmarkCase[] {
    const selected = new Set(options.selectedCases);
    const cases: BuiltBenchmarkCase[] = [];
    const seedIds = seeds.map((x) => this.cypherString(x.id));
    const firstSeedId = seedIds[0];
    const dbTimeout = this._g.userPreferences.dbTimeout.getValue() * 1000;

    if (selected.has("database-summary")) {
      cases.push({
        key: "database-summary",
        label: "Cypher: database summary",
        params: "counts",
        responseType: DbResponseType.table,
        isTimeboxed: false,
        renderGraph: false,
        query: `
          MATCH (s:SEGMENT)
          WITH count(s) AS segments
          OPTIONAL MATCH ()-[l:LINK]->()
          WITH segments, count(l) AS links
          OPTIONAL MATCH ()-[j:JUMP]->()
          WITH segments, links, count(j) AS jumps
          OPTIONAL MATCH ()-[c:CONTAINMENT]->()
          RETURN segments, links, jumps, count(c) AS containments
        `,
      });
    }

    if (selected.has("top-degree")) {
      cases.push({
        key: "top-degree",
        label: "Cypher: top degree segments",
        params: "limit=100",
        responseType: DbResponseType.table,
        isTimeboxed: false,
        renderGraph: false,
        query: `
          MATCH (s:SEGMENT)-[r]-()
          WITH s, count(r) AS degree
          RETURN elementId(s) AS id,
                 s.segmentName AS segmentName,
                 s.segmentLength AS segmentLength,
                 degree
          ORDER BY degree DESC
          LIMIT 100
        `,
      });
    }

    if (selected.has("cypher-edge-sample")) {
      for (const limit of options.graphLimits) {
        cases.push({
          key: "cypher-edge-sample",
          label: "Cypher: edge sample render",
          params: `limit=${limit}`,
          responseType: DbResponseType.graph,
          isTimeboxed: false,
          renderGraph: true,
          query: `
            MATCH (s:SEGMENT)-[e]->(t:SEGMENT)
            RETURN s, e, t
            LIMIT ${limit}
          `,
        });
      }
    }

    if (selected.has("cypher-neighborhood") && firstSeedId) {
      for (const radius of options.neighborhoodRadii) {
        cases.push({
          key: "cypher-neighborhood",
          label: "Cypher: seed neighborhood render",
          params: `radius=${radius}; pathLimit=${options.cypherPathLimit}`,
          responseType: DbResponseType.graph,
          isTimeboxed: false,
          renderGraph: true,
          query: `
            MATCH (startNode)
            WHERE elementId(startNode) = ${firstSeedId}
            MATCH path = (startNode)-[*1..${radius}]-(endNode)
            RETURN path
            LIMIT ${options.cypherPathLimit}
          `,
        });
      }
    }

    if (selected.has("pg2-neighborhood") && seedIds.length > 0) {
      for (const radius of options.neighborhoodRadii) {
        cases.push({
          key: "pg2-neighborhood",
          label: "PG2 procedure: neighborhood",
          params: `radius=${radius}; pageSize=${options.procedurePageSize}`,
          responseType: DbResponseType.table,
          isTimeboxed: false,
          renderGraph: true,
          toGraph: this.tableResponseToGraph.bind(this),
          query: `
            CALL neighborhood([${seedIds.join(",")}], [], ${radius}, true,
              ${options.procedurePageSize}, 1, '', false, null, 2,
              {}, 0, 0, 0, ${dbTimeout}, null)
          `,
        });
      }
    }

    if (selected.has("pg2-graph-of-interest") && seedIds.length > 0) {
      for (const radius of options.neighborhoodRadii) {
        cases.push({
          key: "pg2-graph-of-interest",
          label: "PG2 procedure: graph of interest",
          params: `length=${radius}; pageSize=${options.procedurePageSize}`,
          responseType: DbResponseType.table,
          isTimeboxed: false,
          renderGraph: true,
          toGraph: this.tableResponseToGraph.bind(this),
          query: `
            CALL graphOfInterest([${seedIds.join(",")}], [], ${radius}, true,
              ${options.procedurePageSize}, 1, '', false, null, 2,
              {}, 0, 0, 0, ${dbTimeout}, null)
          `,
        });
      }
    }

    if (selected.has("pg2-common-stream") && seedIds.length > 1) {
      for (const radius of options.neighborhoodRadii) {
        cases.push({
          key: "pg2-common-stream",
          label: "PG2 procedure: common stream",
          params: `length=${radius}; pageSize=${options.procedurePageSize}`,
          responseType: DbResponseType.table,
          isTimeboxed: false,
          renderGraph: true,
          toGraph: this.tableResponseToGraph.bind(this),
          query: `
            CALL commonStream([${seedIds.join(",")}], [], ${radius},
              ${Neo4jEdgeDirection.BOTH}, ${options.procedurePageSize}, 1,
              '', false, null, 2, {}, 0, 0, 0, ${dbTimeout}, null)
          `,
        });
      }
    }

    return cases;
  }

  private async resolveSeeds(options: BenchmarkOptions): Promise<BenchmarkSeed[]> {
    const seedCount = Math.max(1, options.seedCount);
    const seedNames = options.seedSegmentNames.filter((x) => x.length > 0);
    let query: string;

    if (seedNames.length > 0) {
      query = `
        MATCH (s:SEGMENT)
        WHERE s.segmentName IN [${seedNames
          .map((x) => this.cypherString(x))
          .join(",")}]
        OPTIONAL MATCH (s)-[r]-()
        WITH s, count(r) AS degree
        RETURN elementId(s) AS id, s.segmentName AS segmentName, degree
        ORDER BY degree DESC
        LIMIT ${seedCount}
      `;
    } else {
      query = `
        MATCH (s:SEGMENT)-[r]-()
        WITH s, count(r) AS degree
        RETURN elementId(s) AS id, s.segmentName AS segmentName, degree
        ORDER BY degree DESC
        LIMIT ${seedCount}
      `;
    }

    const response = (await this._db.runQueryPromised(
      query,
      DbResponseType.table,
      false,
    )) as TableResponse;
    let seeds = this.tableRowsToSeeds(response);

    if (seeds.length < seedCount && seedNames.length === 0) {
      const fallback = (await this._db.runQueryPromised(
        `
          MATCH (s:SEGMENT)
          RETURN elementId(s) AS id, s.segmentName AS segmentName, 0 AS degree
          LIMIT ${seedCount}
        `,
        DbResponseType.table,
        false,
      )) as TableResponse;
      seeds = this.tableRowsToSeeds(fallback);
    }

    if (seeds.length < 1) {
      throw new Error("No SEGMENT seed could be found for benchmark queries.");
    }

    return seeds;
  }

  private tableRowsToSeeds(response: TableResponse): BenchmarkSeed[] {
    const idIndex = response.columns.indexOf("id");
    const nameIndex = response.columns.indexOf("segmentName");
    const degreeIndex = response.columns.indexOf("degree");
    return response.data.map((row) => ({
      id: String(row[idIndex]),
      segmentName: String(row[nameIndex] ?? ""),
      degree:
        degreeIndex > -1 && row[degreeIndex] !== undefined
          ? Number(row[degreeIndex])
          : undefined,
    }));
  }

  private tableResponseToGraph(data: TableResponse): GraphResponse {
    const indexNodes = data.columns.indexOf("nodes");
    const indexNodeId = data.columns.indexOf("nodeElementId");
    const indexNodeClass = data.columns.indexOf("nodeClass");
    const indexEdges = data.columns.indexOf("edges");
    const indexEdgeId = data.columns.indexOf("edgeElementId");
    const indexEdgeClass = data.columns.indexOf("edgeClass");
    const indexEdgeSourceTarget = data.columns.indexOf("edgeSourceTargets");
    const row = data.data[0] || [];

    const nodes = row[indexNodes] || [];
    const nodeClass = row[indexNodeClass] || [];
    const nodeId = row[indexNodeId] || [];
    const edges = row[indexEdges] || [];
    const edgeClass = row[indexEdgeClass] || [];
    const edgeId = row[indexEdgeId] || [];
    const edgeSourceTarget = row[indexEdgeSourceTarget] || [];

    const graph: GraphResponse = { nodes: [], edges: [] };
    const nodeIds: Record<string, boolean> = {};

    for (let i = 0; i < nodes.length; i++) {
      graph.nodes.push({
        elementId: String(nodeId[i]),
        labels: [String(nodeClass[i])],
        properties: nodes[i],
      });
      nodeIds[String(nodeId[i])] = true;
    }

    for (let i = 0; i < edges.length; i++) {
      const sourceTarget = edgeSourceTarget[i] || [];
      const sourceId = String(sourceTarget[0]);
      const targetId = String(sourceTarget[1]);
      if (nodeIds[sourceId] && nodeIds[targetId]) {
        graph.edges.push({
          properties: edges[i],
          startNodeElementId: sourceId,
          endNodeElementId: targetId,
          elementId: String(edgeId[i]),
          type: String(edgeClass[i]),
        });
      }
    }

    return graph;
  }

  private async renderGraph(
    graph: GraphResponse,
    options: BenchmarkOptions,
  ): Promise<RenderTiming> {
    const renderStart = performance.now();
    let loadEnd = renderStart;
    let layoutStart: number | undefined;
    let layoutStop: number | undefined;

    const layoutPromise = new Promise<RenderTiming>((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          renderSetupMs: loadEnd - renderStart,
          layoutQueueMs:
            layoutStart !== undefined ? layoutStart - loadEnd : undefined,
          layoutMs:
            layoutStart !== undefined && layoutStop !== undefined
              ? layoutStop - layoutStart
              : undefined,
          totalMs: performance.now() - renderStart,
          layoutTimedOut: true,
        });
      }, options.layoutTimeoutMs);

      const onLayoutStart = () => {
        layoutStart = performance.now();
      };
      const onLayoutStop = () => {
        layoutStop = performance.now();
        cleanup();
        this.afterPaint().then(() => {
          resolve({
            renderSetupMs: loadEnd - renderStart,
            layoutQueueMs:
              layoutStart !== undefined ? layoutStart - loadEnd : undefined,
            layoutMs:
              layoutStart !== undefined && layoutStop !== undefined
                ? layoutStop - layoutStart
                : undefined,
            totalMs: performance.now() - renderStart,
            layoutTimedOut: false,
          });
        });
      };
      const cleanup = () => {
        clearTimeout(timeoutId);
        this._g.cy.off("layoutstart", onLayoutStart);
        this._g.cy.off("layoutstop", onLayoutStop);
      };

      this._g.cy.one("layoutstart", onLayoutStart);
      this._g.cy.one("layoutstop", onLayoutStop);
    });

    this._cyService.loadElementsFromDatabase(
      graph,
      false,
      false,
      true,
    );
    loadEnd = performance.now();

    return layoutPromise;
  }

  private afterPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private getTableRowCount(response: TableResponse): number {
    return response && response.data ? response.data.length : 0;
  }

  private payloadKb(response: unknown): number {
    try {
      return this.round(JSON.stringify(response).length / 1024, 2);
    } catch {
      return 0;
    }
  }

  private browserHeapMb(): number | undefined {
    const memory = (performance as any).memory;
    if (!memory || memory.usedJSHeapSize === undefined) {
      return undefined;
    }
    return this.round(memory.usedJSHeapSize / (1024 * 1024), 2);
  }

  private csvCell(value: unknown): string {
    if (value === undefined || value === null) {
      return "";
    }
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
      return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
  }

  private cypherString(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }

  private round(value: number, digits: number): number {
    const m = Math.pow(10, digits);
    return Math.round(value * m) / m;
  }

  private errorMessage(e: unknown): string {
    if (e instanceof Error) {
      return e.message;
    }
    if (typeof e === "string") {
      return e;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown benchmark error";
    }
  }
}
