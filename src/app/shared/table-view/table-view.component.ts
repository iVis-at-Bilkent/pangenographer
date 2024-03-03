import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  Pipe,
  PipeTransform,
  ViewChild,
} from "@angular/core";
import { IPosition } from "angular2-draggable";
import { Subject, Subscription } from "rxjs";
import { EV_MOUSE_OFF, EV_MOUSE_ON, debounce } from "../../visuall/constants";
import { CytoscapeService } from "../../visuall/cytoscape.service";
import { GraphElem } from "../../visuall/db-service/data-types";
import { GlobalVariableService } from "../../visuall/global-variable.service";
import {
  TableFiltering,
  TableViewInput,
  getClassNameFromProperties,
} from "./table-view-types";

@Pipe({ name: "replace" })
export class ReplacePipe implements PipeTransform {
  transform(
    value: string,
    strToReplace: string,
    replacementStr: string
  ): string {
    if (!value || !strToReplace || !replacementStr) {
      return value;
    }

    return value.replace(new RegExp(strToReplace, "g"), replacementStr);
  }
}
@Component({
  selector: "app-table-view",
  templateUrl: "./table-view.component.html",
  styleUrls: ["./table-view.component.css"],
})
export class TableViewComponent implements OnInit, OnDestroy {
  private highlighterFn: (ev: {
    target: any;
    type: string;
    cySelector?: string;
  }) => void;
  private readonly TXT_FILTER_DEBOUNCE = 1000;
  private readonly EMPHASIZE_DEBOUNCE = 50;
  // column index is also a column
  columnLimit: number;
  isDraggable: boolean = false;
  position: IPosition = { x: 0, y: 0 };
  filterTxt: string = "";
  sortDirection: "asc" | "desc" | "" = "";
  sortingIdx: number = -1;
  isLoading: boolean = false;
  isShowTable: boolean = false;
  filterTxtChanged: () => void;
  @ViewChild("dynamicDiv", { static: false }) dynamicDiv;
  checkedIdx: any = {};
  checkedIdx4BlastSegmentNames: any = {};
  emphasizeRowFn: Function;
  higlightOnHoverSubs: Subscription;
  tableFillSubs: Subscription;
  clearFilterSubs: Subscription;
  tableColumnLimitSubs: Subscription;
  hoveredElemId = "-";
  isCheckbox4AllChecked = false;

  @Input() params: TableViewInput;
  @Input() tableFilled = new Subject<boolean>();
  @Input() clearFilter = new Subject<boolean>();
  @Output() onFilteringChanged = new EventEmitter<TableFiltering>();
  @Output() onDataForQueryResult = new EventEmitter<{
    dbIds: string[];
    tableIdx: number[];
  }>();

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _ngZone: NgZone
  ) {}

  ngOnInit() {
    this.tableFillSubs = this.tableFilled.subscribe(
      this.onTableFilled.bind(this)
    );
    this.clearFilterSubs = this.clearFilter.subscribe(
      this.onClearFilter.bind(this)
    );
    this.tableColumnLimitSubs = this._g.userPrefs.tableColumnLimit.subscribe(
      (x) => {
        this.columnLimit = x;
        if (this.params.columnLimit) {
          this.columnLimit = this.params.columnLimit;
        }
      }
    );
    this.highlighterFn = this._cyService.highlightNeighbors();
    this.position.x = 0;
    this.position.y = 0;
    this.filterTxtChanged = debounce(
      this.filterBy.bind(this),
      this.TXT_FILTER_DEBOUNCE
    );
  }

  private resetHoverEvents() {
    this.unbindHiglightOnHovers();
    if (!this.params.isEmphasizeOnHover) {
      return;
    }
    this.higlightOnHoverSubs = this._g.userPrefs.isHighlightOnHover.subscribe(
      (x) => {
        if (x) {
          this.bindHoverListener();
        } else {
          this.unbindHoverListener();
        }
      }
    );
  }

  private bindHoverListener() {
    if (!this.params.isEmphasizeOnHover) {
      return;
    }
    this.emphasizeRowFn = debounce(
      this.elemHovered.bind(this),
      this.EMPHASIZE_DEBOUNCE
    ).bind(this);
    if (this.params.isNodeData) {
      this._g.cy.on("mouseover mouseout", "node", this.emphasizeRowFn);
    } else {
      this._g.cy.on("mouseover mouseout", "edge", this.emphasizeRowFn);
    }
  }

  private unbindHoverListener() {
    if (!this.emphasizeRowFn) {
      return;
    }
    // previous table might be edge or node table
    this._g.cy.off("mouseover mouseout", "edge", this.emphasizeRowFn);
    this._g.cy.off("mouseover mouseout", "node", this.emphasizeRowFn);
  }

  ngOnDestroy() {
    this.unbindHiglightOnHovers();
    if (this.tableColumnLimitSubs) {
      this.tableColumnLimitSubs.unsubscribe();
    }
    if (this.clearFilterSubs) {
      this.clearFilterSubs.unsubscribe();
    }
    if (this.tableFillSubs) {
      this.tableFillSubs.unsubscribe();
    }
  }

  unbindHiglightOnHovers() {
    if (this.higlightOnHoverSubs) {
      this.higlightOnHoverSubs.unsubscribe();
    }
    this.unbindHoverListener();
  }

  private elemHovered(e: any) {
    this._ngZone.run(() => {
      if (e.type == "mouseover") {
        if (this.params.isUseCySelector4Highlight) {
          this.hoveredElemId = "#" + e.target.id();
        } else {
          this.hoveredElemId = e.target.id().substr(1);
        }
      } else {
        this.hoveredElemId = "-";
      }
    });
  }

  private onTableFilled() {
    this.isLoading = false;
    this.resetCheckedIdxs();
    this.isCheckbox4AllChecked = false;
    if (this.params.results && this.params.results.length > 0) {
      this.isShowTable = true;
    } else if (this.filterTxt.length == 0) {
      this.isShowTable = false;
    }
    this.resetHoverEvents();
    this.setColumnLimit();
  }

  private onClearFilter() {
    this.filterTxt = "";
    this.sortingIdx = -1;
    this.sortDirection = "";
  }

  filterBy() {
    this.isLoading = true;
    this.onFilteringChanged.emit({
      txt: this.filterTxt,
      orderBy: this.params.columns[this.sortingIdx],
      orderDirection: this.sortDirection,
    });
  }

  onMouseEnter(id: string) {
    if (
      this.params.isDisableHover ||
      !this._g.userPrefs.isHighlightOnHover.getValue()
    ) {
      return;
    }
    if (this.params.isUseCySelector4Highlight) {
      this.highlighterFn({ target: null, type: EV_MOUSE_ON, cySelector: id });
    } else {
      let target = this._g.cy.elements(`[id = "n${id}"]`);
      if (!this.params.isNodeData) {
        target = this._g.cy.edges(`[id = "e${id}"]`);
      }
      this.highlighterFn({ target: target, type: EV_MOUSE_ON });
    }
  }

  onMouseExit(id: string) {
    if (
      this.params.isDisableHover ||
      !this._g.userPrefs.isHighlightOnHover.getValue()
    ) {
      return;
    }
    if (this.params.isUseCySelector4Highlight) {
      this.highlighterFn({ target: null, type: EV_MOUSE_OFF, cySelector: id });
    } else {
      let target = this._g.cy.elements(`[id = "n${id}"]`);
      if (!this.params.isNodeData) {
        target = this._g.cy.edges(`[id = "e${id}"]`);
      }
      this.highlighterFn({ target: target, type: EV_MOUSE_OFF });
    }
  }

  pageChanged(newPage: number) {
    this.isCheckbox4AllChecked = false;
    let o = this.params.columns[this.sortingIdx];
    let skip = (newPage - 1) * this.params.pageSize;
    this.onFilteringChanged.emit({
      txt: this.filterTxt,
      orderBy: o,
      orderDirection: this.sortDirection,
      skip: skip,
    });
  }

  isNumber(v: any) {
    return typeof v === "number";
  }

  resetPosition(isDraggable: boolean) {
    this.isDraggable = isDraggable;
    if (this.isDraggable) {
      this.position = { x: -130, y: 0 };
    } else {
      this.position = { x: 0, y: 0 };
    }
    this.setColumnLimit();
  }

  private setColumnLimit() {
    if (this.isDraggable) {
      this.columnLimit = this.params.columns.length;
    } else {
      if (this.params.columnLimit) {
        this.columnLimit = this.params.columnLimit;
      } else {
        this.columnLimit = this._g.userPrefs.tableColumnLimit.getValue();
      }
    }
  }

  columnClicked(i: number) {
    this.isLoading = true;
    this.sortingIdx = i;
    let o = this.params.columns[i];
    if (this.sortDirection == "asc") {
      this.sortDirection = "desc";
    } else if (this.sortDirection == "desc") {
      this.sortDirection = "";
    } else if (this.sortDirection == "") {
      this.sortDirection = "asc";
    }
    this.onFilteringChanged.emit({
      txt: this.filterTxt,
      orderBy: o,
      orderDirection: this.sortDirection,
    });
  }

  checkboxChanged(
    idx: number,
    t: EventTarget = undefined, // undefined for setting checked status
    forceCheck?: boolean
  ) {
    if (t !== undefined) {
      const isChecked = (<HTMLInputElement>t).checked;
      if (isChecked) {
        this.checkedIdx[idx] = true;
        this.checkboxHighlightChangedBlast(idx, true);
      } else {
        delete this.checkedIdx[idx];
        this.checkboxHighlightChangedBlast(idx, false);
      }
    } else if (forceCheck) {
      this.checkedIdx[idx] = true;
      this.checkboxHighlightChangedBlast(idx, true);
    } else {
      delete this.checkedIdx[idx];
      this.checkboxHighlightChangedBlast(idx, false);
    }
  }

  checkboxHighlightChangedBlast(idx: number, highlight: boolean) {
    if (
      this.params.isBlastResultTable &&
      this.params.isUseCySelector4Highlight
    ) {
      let segmentName = this.params.results[idx][2].val;
      if (highlight) {
        if (this.checkedIdx4BlastSegmentNames[segmentName]) {
          this.checkedIdx4BlastSegmentNames[segmentName]++;
        } else {
          this.checkedIdx4BlastSegmentNames[segmentName] = 1;
          this._g.highlightElements(
            this._g.cy.nodes(`[segmentName = "${segmentName}"]`)
          );
        }
      } else {
        if (this.checkedIdx4BlastSegmentNames[segmentName] > 1) {
          this.checkedIdx4BlastSegmentNames[segmentName]--;
        } else {
          delete this.checkedIdx4BlastSegmentNames[segmentName];
          this._g.removeHighlights(
            this._g.cy.nodes(`[segmentName = "${segmentName}"]`)
          );
        }
      }
    }
  }

  loadGraph4Checked() {
    // index 0 keeps database IDs
    let dbIds = this.params.results
      .filter((_, i) => this.checkedIdx[i])
      .map((x) => x[0].val) as string[];
    let idxes = [];
    for (let i in this.checkedIdx) {
      idxes.push(Number(i) + 1);
    }
    if (dbIds.length > 0) {
      this.onDataForQueryResult.emit({ dbIds: dbIds, tableIdx: idxes });
    }
  }

  checkbox4AllChanged() {
    this.resetCheckedIdxs();
    let elems = this.dynamicDiv.nativeElement.querySelectorAll(".row-cb");
    let elemsArr: HTMLInputElement[] = [];
    for (let i = 0; i < elems.length; i++) {
      elemsArr.push(elems[i] as HTMLInputElement);
    }
    elemsArr = elemsArr.filter((x) => !x.parentElement.hidden);

    if (this.isCheckbox4AllChecked) {
      for (let i = 0; i < this.params.results.length; i++) {
        this.checkboxChanged(i, undefined, true);
        elemsArr[i].checked = true;
      }
    } else {
      for (let i = 0; i < elemsArr.length; i++) {
        this.checkboxChanged(i, undefined, false);
        elemsArr[i].checked = false;
      }
    }
  }

  tableStateChanged() {
    this.isDraggable = !this.isDraggable;
    this.resetPosition(this.isDraggable);
    if (!this.isDraggable) {
      const e = this.dynamicDiv.nativeElement;
      e.style.width = "";
      e.style.height = "";
    }
  }

  downloadAsCSV4Checked() {
    let rows = this.params.results;
    let cNames = this.params.classNames;
    if (!this.params.isLoadGraph) {
      rows = rows.filter((_, i) => this.checkedIdx[i]);
      if (cNames) {
        cNames = cNames.filter((_, i) => this.checkedIdx[i]);
      }
    }
    const props = this._g.dataModel.getValue();
    let objs: GraphElem[] = [];
    let prefix = this.params.isNodeData ? "n" : "e";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let cName = this.params.classNameOfObjects;

      if (!cName) {
        if (this.params.classNames && this.params.classNames[i]) {
          cName = cNames[i];
        } else {
          cName = getClassNameFromProperties(props, this.params.columns);
        }
      }
      const data = {};
      // first index is for ID
      for (let i = 1; i < r.length; i++) {
        data[this.params.columns[i - 1]] = r[i].val;
      }
      data["id"] = prefix + r[0].val;
      if (this.params.isUseCySelector4Highlight) {
        data["id"] = r[0].val.substr(1);
      }
      objs.push({ classes: cName, data: data });
    }
    this._cyService.saveAsCSV(objs);
  }

  truncateData(data: string): string {
    if (data.length > 240) {
      return data.substring(0, 238) + "...";
    }
    return data;
  }

  private resetCheckedIdxs() {
    this.checkedIdx = {};
    this.checkedIdx4BlastSegmentNames = {};
  }
}
