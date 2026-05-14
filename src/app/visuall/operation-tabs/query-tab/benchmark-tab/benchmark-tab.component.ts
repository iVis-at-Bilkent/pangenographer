import { Component } from "@angular/core";
import {
  BENCHMARK_CASES,
  BenchmarkCaseDefinition,
  BenchmarkCaseKey,
  BenchmarkOptions,
  BenchmarkRunResult,
  BenchmarkService,
} from "../../../benchmark.service";

interface BenchmarkCaseSelection extends BenchmarkCaseDefinition {
  selected: boolean;
}

@Component({
  selector: "app-benchmark-tab",
  templateUrl: "./benchmark-tab.component.html",
  styleUrls: ["./benchmark-tab.component.css"],
})
export class BenchmarkTabComponent {
  options: BenchmarkOptions;
  caseSelections: BenchmarkCaseSelection[];
  graphLimitsText = "";
  neighborhoodRadiiText = "";
  seedNamesText = "";
  isRunning = false;
  status = "";
  results: BenchmarkRunResult[] = [];

  constructor(private _benchmarkService: BenchmarkService) {
    this.options = this._benchmarkService.getDefaultOptions();
    this.graphLimitsText = this.options.graphLimits.join(", ");
    this.neighborhoodRadiiText = this.options.neighborhoodRadii.join(", ");
    this.caseSelections = BENCHMARK_CASES.map((x) => ({
      ...x,
      selected: this.options.selectedCases.includes(x.key),
    }));
  }

  async runBenchmarks(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.results = [];
    this.status = "Preparing benchmark cases...";
    this.isRunning = true;
    this.applyFormOptions();

    try {
      await this._benchmarkService.runSuite(this.options, (result) => {
        this.results = this.results.concat(result);
        this.status = `${this.completedMeasuredRuns()} measured runs completed`;
      });
      if (this.results.some((x) => x.status === "cancelled")) {
        this.status = "Benchmark cancelled.";
      } else {
        this.status = "Benchmark complete.";
      }
    } catch (e) {
      this.status = this.errorMessage(e);
    } finally {
      this.isRunning = false;
    }
  }

  stopBenchmarks(): void {
    this._benchmarkService.stop();
    this.status = "Stopping after current query/layout finishes...";
  }

  clearResults(): void {
    if (this.isRunning) {
      return;
    }
    this.results = [];
    this.status = "";
  }

  exportCsv(): void {
    if (this.results.length < 1) {
      return;
    }
    this._benchmarkService.downloadCsv(this.results);
  }

  measuredResults(): BenchmarkRunResult[] {
    return this.results.filter((x) => x.measured);
  }

  completedMeasuredRuns(): number {
    return this.results.filter((x) => x.measured && x.status === "ok").length;
  }

  formatMs(value: number | undefined): string {
    if (value === undefined || value === null) {
      return "";
    }
    return value.toFixed(1);
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) {
      return "";
    }
    return value.toLocaleString();
  }

  private applyFormOptions(): void {
    this.options.graphLimits = this.parsePositiveInts(
      this.graphLimitsText,
      this.options.graphLimits,
    );
    this.options.neighborhoodRadii = this.parsePositiveInts(
      this.neighborhoodRadiiText,
      this.options.neighborhoodRadii,
    );
    this.options.seedSegmentNames = this.parseList(this.seedNamesText);
    this.options.selectedCases = this.caseSelections
      .filter((x) => x.selected)
      .map((x) => x.key as BenchmarkCaseKey);
    this.options.warmupRuns = Math.max(0, Number(this.options.warmupRuns) || 0);
    this.options.measuredRuns = Math.max(
      1,
      Number(this.options.measuredRuns) || 1,
    );
    this.options.procedurePageSize = Math.max(
      1,
      Number(this.options.procedurePageSize) || 1,
    );
    this.options.cypherPathLimit = Math.max(
      1,
      Number(this.options.cypherPathLimit) || 1,
    );
    this.options.seedCount = Math.max(1, Number(this.options.seedCount) || 1);
    this.options.layoutTimeoutMs = Math.max(
      1000,
      Number(this.options.layoutTimeoutMs) || 1000,
    );
  }

  private parsePositiveInts(text: string, fallback: number[]): number[] {
    const parsed = text
      .split(/[\s,;]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => Math.floor(x));
    return parsed.length > 0 ? parsed : fallback;
  }

  private parseList(text: string): string[] {
    return text
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  private errorMessage(e: unknown): string {
    if (e instanceof Error) {
      return e.message;
    }
    if (typeof e === "string") {
      return e;
    }
    return "Benchmark failed.";
  }
}
