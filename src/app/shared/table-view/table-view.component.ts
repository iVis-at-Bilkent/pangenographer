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
import {
  DEFAULT_NODE_WIDTH,
  EV_MOUSE_OFF,
  EV_MOUSE_ON,
  TABLE_ALL_CHECK_DELAY,
  debounce,
} from "../../visuall/constants";
import { CytoscapeService } from "../../visuall/cytoscape.service";
import { GraphElement } from "../../visuall/db-service/data-types";
import { ExternalToolService } from "../../visuall/external-tool.service";
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
  sortingIndex: number = -1;
  isLoading: boolean = false;
  isShowTable: boolean = false;
  filterTxtChanged: () => void;
  @ViewChild("dynamicDiv", { static: false }) dynamicDiv;
  checkedIndex: any = {};
  emphasizeRowFn: Function;
  higlightOnHoverSubscription: Subscription;
  tableFillSubscription: Subscription;
  clearFilterSubscription: Subscription;
  tableColumnLimitSubscription: Subscription;
  hoveredElementId = "-";
  isCheckbox4AllChecked: boolean = false;

  elementBadgeMaxPercentages: any = {};
  badgeColor = "#69D96E";

  @Input() params: TableViewInput;
  @Input() tableFilled = new Subject<boolean>();
  @Input() clearFilter = new Subject<boolean>();
  @Output() onFilteringChanged = new EventEmitter<TableFiltering>();
  @Output() onDataForQueryResult = new EventEmitter<{
    dbIds: string[];
    tableIndex: number[];
  }>();

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _ngZone: NgZone,
    private _extTool: ExternalToolService
  ) {}

  ngOnInit() {
    this.tableFillSubscription = this.tableFilled.subscribe(
      this.onTableFilled.bind(this)
    );
    this.clearFilterSubscription = this.clearFilter.subscribe(
      this.onClearFilter.bind(this)
    );
    this.tableColumnLimitSubscription =
      this._g.userPreferences.tableColumnLimit.subscribe((x) => {
        this.columnLimit = x;
        if (this.params.columnLimit) {
          this.columnLimit = this.params.columnLimit;
        }
      });
    this.highlighterFn = this._cyService.highlightNeighbors();
    this.position.x = 0;
    this.position.y = 0;
    this.filterTxtChanged = debounce(
      this.filterBy.bind(this),
      this.TXT_FILTER_DEBOUNCE
    );

    this._g.cy.on("remove", (e: any) => {
      this._extTool.destroyBadgePopper(e.target.id(), -1);
    });

    // If table is loaded with allChecked true, check all checkboxes
    this.checkAll();
  }

  // Checks all in the page if all conditions are met with the help of a delay
  private checkAll() {
    if (this.params.allChecked) {
      setTimeout(() => this.checkbox4AllChanged(), TABLE_ALL_CHECK_DELAY);
    }
  }

  private resetHoverEvents() {
    this.unbindHiglightOnHovers();
    if (!this.params.isEmphasizeOnHover) {
      return;
    }
    this.higlightOnHoverSubscription =
      this._g.userPreferences.isHighlightOnHover.subscribe((x) => {
        if (x) {
          this.bindHoverListener();
        } else {
          this.unbindHoverListener();
        }
      });
  }

  private bindHoverListener() {
    if (!this.params.isEmphasizeOnHover) {
      return;
    }
    this.emphasizeRowFn = debounce(
      this.elementHovered.bind(this),
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
    if (this.tableColumnLimitSubscription) {
      this.tableColumnLimitSubscription.unsubscribe();
    }
    if (this.clearFilterSubscription) {
      this.clearFilterSubscription.unsubscribe();
    }
    if (this.tableFillSubscription) {
      this.tableFillSubscription.unsubscribe();
    }
  }

  unbindHiglightOnHovers() {
    if (this.higlightOnHoverSubscription) {
      this.higlightOnHoverSubscription.unsubscribe();
    }
    this.unbindHoverListener();
  }

  private elementHovered(e: any) {
    this._ngZone.run(() => {
      if (e.type == "mouseover") {
        if (this.params.isUseCySelector4Highlight) {
          this.hoveredElementId = "#" + e.target.id();
        } else {
          this.hoveredElementId = e.target.id().substr(1);
        }
      } else {
        this.hoveredElementId = "-";
      }
    });
  }

  private onTableFilled() {
    this.isLoading = false;
    this.checkedIndex = {};
    this.elementBadgeMaxPercentages = {};
    this.isCheckbox4AllChecked = this.params.allChecked;
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
    this.sortingIndex = -1;
    this.sortDirection = "";
  }

  filterBy() {
    this.isLoading = true;
    this.onFilteringChanged.emit({
      txt: this.filterTxt,
      orderBy: this.params.columns[this.sortingIndex],
      orderDirection: this.sortDirection,
    });
  }

  onMouseEnter(id: string) {
    if (
      this.params.isDisableHover ||
      !this._g.userPreferences.isHighlightOnHover.getValue()
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
      !this._g.userPreferences.isHighlightOnHover.getValue()
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
    this.isCheckbox4AllChecked = this.params.allChecked;
    this.checkAll();
    let o = this.params.columns[this.sortingIndex];
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
        this.columnLimit = this._g.userPreferences.tableColumnLimit.getValue();
      }
    }
  }

  columnClicked(i: number) {
    this.isLoading = true;
    this.sortingIndex = i;
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

  // This function is called when a checkbox is clicked in the table
  // It updates the checkedIndex object and calls the function to place badges on the graph
  // if the table is a blast result table and the user has selected to use cytoscape selector for highlighting
  // forceCheck is used to set the checked status of the checkbox
  checkboxChanged(
    index: number,
    t: EventTarget = undefined, // undefined for setting checked status
    forceCheck?: boolean
  ) {
    // t is the target HTML element of the event
    // if t is undefined, it means that the function is called to set the checked status of the checkbox
    // if t is defined, it means that the function is called by the checkbox click event
    if (t !== undefined) {
      // Get the checked status of the checkbox
      const isChecked = (<HTMLInputElement>t).checked;

      // Update the checkedIndex object according to the checked status of the checkbox
      if (isChecked) {
        this.checkedIndex[index] = true;
      }
      // If the checkbox is unchecked, remove the index from the checkedIndex object
      else {
        delete this.checkedIndex[index];
      }
    }
    // If the function is called to set the checked status of the checkbox
    else if (forceCheck && !this.checkedIndex[index]) {
      this.checkedIndex[index] = true;
    }
    // If the function is called to set the checked status of the checkbox
    else if (!forceCheck && this.checkedIndex[index]) {
      delete this.checkedIndex[index];
    }

    // If the table is a blast result table and the user has selected to use cytoscape selector for highlighting
    // place percentage badges on the graph nodes for the checked rows
    // and update the cues for the checked rows
    if (
      this.params.isBlastResultTable &&
      this.params.isUseCySelector4Highlight
    ) {
      // Place percentage badges on the graph nodes for the checked rows
      this.placeBlastTableResultBadges();

      // The cues need to be updated after the badges are placed on the graph
      // as the nodes are resized according to the maximum percentage values
      this._g.refreshCuesBadges();
    }
  }

  // This function is called to place percentage badges on the graph nodes for the checked rows
  private placeBlastTableResultBadges() {
    // Destroy the existing badges on the graph
    this._extTool.destroyCurrentBadgePoppers();
    // Reset the elementBadgeMaxPercentages object
    this.elementBadgeMaxPercentages = {};

    // Get the maximum percentage value for each segment name
    for (let index in this.checkedIndex) {
      let segmentName = this.params.results[index][2].value;
      let percentage = this.params.results[index][3].value;

      // If the segment name is not in the elementBadgeMaxPercentages object, add it
      if (!this.elementBadgeMaxPercentages[segmentName]) {
        this.elementBadgeMaxPercentages[segmentName] = percentage;
      }
      // If the segment name is in the elementBadgeMaxPercentages object, update the maximum percentage value
      else {
        this.elementBadgeMaxPercentages[segmentName] = Math.max(
          percentage,
          this.elementBadgeMaxPercentages[segmentName]
        );
      }
    }

    // Set the badge popper values for the graph nodes
    // Set the badge color to the badgeColor
    // Set the badge size to DEFAULT_NODE_WIDTH
    // isMapNodeSizes is set to true
    // isMapBadgeSizes is set to false
    // Set the maximum percentage value as the maximum property value as 100
    this._extTool.setBadgePopperValues(
      true,
      false,
      DEFAULT_NODE_WIDTH,
      100,
      this.badgeColor
    );

    // Set the badge size on the graph nodes according to the maximum percentage values
    this._cyService.setNodeSizeOnGraphTheoreticProp(100, DEFAULT_NODE_WIDTH);

    // Generate badges for the graph nodes
    for (let segmentName in this.elementBadgeMaxPercentages) {
      // Create the badges array to store the maximum percentage value
      let badges = [];
      badges.push(this.elementBadgeMaxPercentages[segmentName]);

      // Generate the badge for the graph node
      this._extTool.generateBadge4Element(
        this._g.cy.nodes(`[segmentName = "${segmentName}"]`)[0],
        badges
      );
    }

    // Set the badge colors and coordinates
    this._extTool.setBadgeColorsAndCoords();
  }

  loadGraph4Checked() {
    // index 0 keeps database IDs
    let dbIds = this.params.results
      .filter((_, i) => this.checkedIndex[i])
      .map((x) => x[0].value) as string[];
    let indexes = [];
    for (let i in this.checkedIndex) {
      indexes.push(Number(i) + 1);
    }
    if (dbIds.length > 0) {
      this.onDataForQueryResult.emit({ dbIds: dbIds, tableIndex: indexes });
    }
  }

  checkbox4AllChanged() {
    let elements = this.dynamicDiv.nativeElement.querySelectorAll(".row-cb");
    let elementsArray: HTMLInputElement[] = [];
    for (let i = 0; i < elements.length; i++) {
      elementsArray.push(elements[i] as HTMLInputElement);
    }
    elementsArray = elementsArray.filter((x) => !x.parentElement.hidden);

    if (this.isCheckbox4AllChecked) {
      for (let i = 0; i < this.params.results.length; i++) {
        this.checkboxChanged(i, undefined, true);
        elementsArray[i].checked = true;
        this.checkedIndex[i] = true;
      }
    } else {
      for (let i = 0; i < elementsArray.length; i++) {
        this.checkboxChanged(i, undefined, false);
        elementsArray[i].checked = false;
        delete this.checkedIndex[i];
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
      rows = rows.filter((_, i) => this.checkedIndex[i]);
      if (cNames) {
        cNames = cNames.filter((_, i) => this.checkedIndex[i]);
      }
    }
    const props = this._g.dataModel.getValue();
    let objects: GraphElement[] = [];
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
        data[this.params.columns[i - 1]] = r[i].value;
      }
      data["id"] = prefix + r[0].value;
      if (this.params.isUseCySelector4Highlight) {
        data["id"] = r[0].value.substr(1);
      }
      objects.push({ classes: cName, data: data });
    }
    this._cyService.saveAsCSV(objects);
  }

  truncateData(data: string): string {
    if (data.length > 240) {
      return data.substring(0, 238) + "...";
    }
    return data;
  }
}
