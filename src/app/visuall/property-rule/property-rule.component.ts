import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { IPosition } from "angular2-draggable";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import {
  ENUM_OPERATORS,
  GENERIC_TYPE,
  LIST_OPERATORS,
  NUMBER_OPERATORS,
  TEXT_OPERATORS,
  isNumber,
} from "../constants";
import { GlobalVariableService } from "../global-variable.service";
import { Rule, RuleSync } from "../operation-tabs/map-tab/query-types";
import { UserProfileService } from "../user-profile.service";

@Component({
  selector: "app-property-rule",
  templateUrl: "./property-rule.component.html",
  styleUrls: ["./property-rule.component.css"],
})
export class PropertyRuleComponent implements OnInit {
  private attributeType: string;
  private readonly NO_OPERATION = "no_op";
  private operators: any;
  private readonly NOT_SELECTED = "───";
  private readonly ONE_OF = "one of";

  selectedProp: string;
  isGenericTypeSelected = true;
  selectedClassProps: string[];
  selectedOperatorKey: string;
  operatorKeys: string[];
  filterInp: string;
  optInp: string;
  textAreaInp: string = "";
  selectedClass: string;
  currInpType: string = "text";
  @Input() propertyChanged: Subject<RuleSync>;
  @Input() loadRule: Rule;
  @Input() isStrict: boolean;
  @Input() refreshView: Subject<boolean>;
  @Output() onRuleReady = new EventEmitter<Rule>();
  @ViewChild("multiSelect", { static: false }) multiSelect: ElementRef;
  isShowTxtArea = false;
  txtAreaSize: { width: number; height: number } = { width: 350, height: 250 };
  position: IPosition = { x: 0, y: 0 };
  propChangeSubscription: Subscription;
  option2selected = {};
  currentListName = "New List";
  fittingSavedLists: string[] = [];
  currSelectedList: string;

  constructor(
    private _g: GlobalVariableService,
    private _profile: UserProfileService
  ) {}

  ngOnInit() {
    this.propChangeSubscription = this.propertyChanged.subscribe((x) => {
      this.updateView(x.properties, x.isGenericTypeSelected, x.selectedClass);
    });
  }

  ngOnDestroy() {
    if (this.propChangeSubscription) {
      this.propChangeSubscription.unsubscribe();
    }
  }

  updateView(props: string[], isGeneric: boolean, cName: string) {
    this.selectedClassProps = props;
    this.isGenericTypeSelected = isGeneric;
    this.selectedClass = cName;
    this.filterInp = "";
    this.selectedProp = null;
    this.selectedOperatorKey = null;

    if (this.loadRule) {
      this.filterInp = this.loadRule.inputOperand;
      this.selectedProp = this.loadRule.propertyOperand;
      // will set the operators according to selected property
      this.changeSelectedProp(this.filterInp);
      for (const opKey in this.operators) {
        if (this.operators[opKey] == this.loadRule.operator) {
          this.selectedOperatorKey = opKey;
        }
      }
    } else {
      this.changeSelectedProp();
    }
    if (this.selectedOperatorKey === this.ONE_OF) {
      this.currInpType = "text";
    }
  }

  changeSelectedProp(filterInp = "") {
    const model = this._g.dataModel.getValue();
    this.textAreaInp = "";
    this.selectedOperatorKey = null;
    this.filterInp = filterInp;
    let attrType = undefined;
    if (model.nodes[this.selectedClass]) {
      attrType = model.nodes[this.selectedClass][this.selectedProp];
    } else if (model.edges[this.selectedClass]) {
      attrType = model.edges[this.selectedClass][this.selectedProp];
    }
    if (model.edges[this.selectedProp]) {
      attrType = "edge";
    }
    this.attributeType = attrType;
    this.operators = {};
    this.operatorKeys = [];

    this.operators[this.NO_OPERATION] = this.NO_OPERATION;
    this.operatorKeys.push(this.NOT_SELECTED);
    if (!attrType) {
      return;
    }

    if (attrType == "string") {
      this.currInpType = "text";
      this.addOperators(TEXT_OPERATORS);
    } else if (
      attrType == "float" ||
      attrType == "int" ||
      attrType == "edge" ||
      attrType == "number"
    ) {
      this.currInpType = "number";
      this.addOperators(NUMBER_OPERATORS);
    } else if (attrType == "list") {
      this.addOperators(LIST_OPERATORS);
      this.currInpType = "text";
    } else if (attrType.startsWith("enum")) {
      this.addOperators(ENUM_OPERATORS);
    }
  }

  isNumberProperty(): boolean {
    const model = this._g.dataModel.getValue();
    let attrType = undefined;
    if (model.nodes[this.selectedClass]) {
      attrType = model.nodes[this.selectedClass][this.selectedProp];
    } else if (model.edges[this.selectedClass]) {
      attrType = model.edges[this.selectedClass][this.selectedProp];
    }
    if (model.edges[this.selectedProp]) {
      attrType = "edge";
    }
    return attrType == "float" || attrType == "int" || attrType == "edge";
  }

  @HostListener("document:keydown.enter", ["$event"])
  onAddRuleClick(event: MouseEvent) {
    // do not enter rule with keyboard shortcut if we are showing text area for 'one of'
    if (event && this.isShowTxtArea) {
      return;
    }
    const attribute = this.selectedProp;
    let value: any = this.filterInp;
    let rawValue: any = this.filterInp;

    let operator = this.operators[this.selectedOperatorKey];
    let atType = this.attributeType;
    if (atType && atType.startsWith("enum")) {
      atType = atType.substr(atType.indexOf(",") + 1);
    }

    if (atType == "int") {
      value = parseInt(value);
    } else if (atType == "float") {
      value = parseFloat(value);
    }

    if (this.selectedOperatorKey === this.ONE_OF) {
      value = this.filterInp;
    }

    if (Number.isNaN(value)) {
      value = "";
    }
    const rule: Rule = {
      propertyOperand: attribute,
      propertyType: atType,
      rawInput: rawValue,
      inputOperand: value,
      ruleOperator: null,
      operator: operator,
    };
    const isOk = this.isStrictlyValid(rule);
    if (this.isStrict && !isOk) {
      this._g.showErrorModal("Error", "Invalid Rule!");
      return;
    }
    this.onRuleReady.emit(rule);
  }

  filterInpClicked() {
    if (this.selectedOperatorKey != this.ONE_OF || this.isShowTxtArea) {
      return;
    }
    if (this.position.x == 0 && this.position.y == 0) {
      this.position = { x: -130, y: 0 };
    }
    this.isShowTxtArea = true;
    this.currentListName = "New list";
    this.currSelectedList = null;
    this.fillFittingSavedLists();
    this.currInpType = "text";
    if (typeof this.filterInp !== "string") {
      this.filterInp = "" + this.filterInp;
    }
    this.textAreaInp = this.filterInp.split(",").join("\n");
  }

  optSelected() {
    this.filterInp = this.optInp;
  }

  txtAreaPopupOk() {
    this.filterInp = this.textAreaInp.trim().split("\n").join(",");
    this.isShowTxtArea = false;
  }

  txtAreaPopupCancel() {
    this.textAreaInp = this.filterInp.split(",").join("\n");
    this.isShowTxtArea = false;
  }

  onMoveEnd(e: any) {
    this.position = e;
  }

  onResizeStop(e: any) {
    this.txtAreaSize = e.size;
  }

  saveCurrList() {
    let selectedOptions = this.textAreaInp
      .split("\n")
      .map((x) => new BehaviorSubject<string>(x));
    const isNum = this.isNumberProperty();
    // the button to fire this function will only be visible when operator is 'one of'
    let theLists: {
      name: BehaviorSubject<string>;
      values: BehaviorSubject<string>[];
    }[] = null;
    if (isNum) {
      theLists = this._g.userPreferences.savedLists.numberLists;
    } else {
      theLists = this._g.userPreferences.savedLists.stringLists;
    }
    const index = theLists.findIndex(
      (x) => x.name.getValue() == this.currentListName
    );
    if (index > -1) {
      theLists[index].values = selectedOptions;
    } else {
      theLists.push({
        name: new BehaviorSubject<string>(this.currentListName),
        values: selectedOptions,
      });
    }
    this.currSelectedList = this.currentListName;
    this._profile.saveUserPreferences();
    this.fillFittingSavedLists();
  }

  deleteList() {
    const isNum = this.isNumberProperty();
    // the button to fire this function will only be visible when operator is 'one of'
    let theLists: {
      name: BehaviorSubject<string>;
      values: BehaviorSubject<string>[];
    }[] = null;
    if (isNum) {
      theLists = this._g.userPreferences.savedLists.numberLists;
    } else {
      theLists = this._g.userPreferences.savedLists.stringLists;
    }
    const index = theLists.findIndex(
      (x) => x.name.getValue() == this.currSelectedList
    );
    if (index > -1) {
      theLists.splice(index, 1);
    }
    this.currentListName = "";
    this._profile.saveUserPreferences();
    this.fillFittingSavedLists();
  }

  changeSelectedSavedList(t: EventTarget) {
    let ev = (<HTMLInputElement>t).value;
    this.currentListName = ev;
    let savedList: BehaviorSubject<string>[] = [];
    const isNum = this.isNumberProperty();
    if (isNum) {
      savedList = this._g.userPreferences.savedLists.numberLists.find(
        (x) => x.name.getValue() === ev
      ).values;
    } else {
      savedList = this._g.userPreferences.savedLists.stringLists.find(
        (x) => x.name.getValue() === ev
      ).values;
    }

    this.textAreaInp = savedList.map((x) => x.getValue()).join("\n");
  }

  private fillFittingSavedLists() {
    this.fittingSavedLists.length = 0;
    const l = this._g.userPreferences.savedLists;
    const isNum = this.isNumberProperty();
    if (isNum) {
      this.fittingSavedLists = l.numberLists.map((x) => x.name.getValue());
    } else {
      this.fittingSavedLists = l.stringLists.map((x) => x.name.getValue());
    }
  }

  private addOperators(op: any) {
    for (let [k, v] of Object.entries(op)) {
      this.operators[k] = v;
      this.operatorKeys.push(k);
    }
  }

  private isStrictlyValid(rule: Rule) {
    const p = rule.propertyOperand;
    // property not selected, so only a class is selected
    if (p == null || p == GENERIC_TYPE.NOT_SELECTED) {
      return true;
    }
    const op = rule.operator;
    // property is selected so an operator must be selected
    if (op === undefined || op === null) {
      return false;
    }
    const input = rule.inputOperand;
    // property, operator are selected so an input must be provided
    if (input === undefined || input === null) {
      return false;
    }
    const t = rule.propertyType;
    if (
      (t == "float" || t == "int") &&
      !isNumber(input) &&
      this.selectedOperatorKey != this.ONE_OF
    ) {
      return false;
    }
    return true;
  }
}
