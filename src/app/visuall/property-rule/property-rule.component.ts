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
import flatpickr from "flatpickr";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import {
  DATETIME_OPERATORS,
  ENUM_OPERATORS,
  GENERIC_TYPE,
  LIST_OPERATORS,
  NUMBER_OPERATORS,
  TEXT_OPERATORS,
  isNumber,
} from "../constants";
import { GlobalVariableService } from "../global-variable.service";
import {
  PropertyCategory,
  Rule,
  RuleSync,
} from "../operation-tabs/map-tab/query-types";
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
  selectedPropertyCategory: PropertyCategory;
  filterInp: string;
  optInp: string;
  textAreaInp: string = "";
  finiteSetPropertyMap: any = null;
  selectedClass: string;
  currInpType: string = "text";
  @Input() propertyChanged: Subject<RuleSync>;
  @Input() loadRule: Rule;
  @Input() isStrict: boolean;
  @Input() refreshView: Subject<boolean>;
  @Output() onRuleReady = new EventEmitter<Rule>();
  @ViewChild("dateInp", { static: false }) dateInp: ElementRef;
  @ViewChild("multiSelect", { static: false }) multiSelect: ElementRef;
  isShowTxtArea = false;
  txtAreaSize: { width: number; height: number } = { width: 350, height: 250 };
  position: IPosition = { x: 0, y: 0 };
  propChangeSubs: Subscription;
  option2selected = {};
  currListName = "New List";
  fittingSavedLists: string[] = [];
  currSelectedList: string;

  constructor(
    private _g: GlobalVariableService,
    private _profile: UserProfileService
  ) {}

  ngOnInit() {
    this.propChangeSubs = this.propertyChanged.subscribe((x) => {
      this.updateView(x.properties, x.isGenericTypeSelected, x.selectedClass);
    });
  }

  ngOnDestroy() {
    if (this.propChangeSubs) {
      this.propChangeSubs.unsubscribe();
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
      this.changeSelectedProp(this.filterInp, this.loadRule.rawInput);
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

  changeSelectedProp(filterInp = "", unixDateValue = null) {
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
    this.selectedPropertyCategory = this.getPropertyCategory();

    this.operators[this.NO_OPERATION] = this.NO_OPERATION;
    this.operatorKeys.push(this.NOT_SELECTED);
    if (!attrType) {
      return;
    }
    if (attrType == "string") {
      this.currInpType = "text";
      this.addOperators(TEXT_OPERATORS);
    } else if (attrType == "float" || attrType == "int" || attrType == "edge") {
      this.currInpType = "number";
      this.addOperators(NUMBER_OPERATORS);
    } else if (attrType == "list") {
      this.addOperators(LIST_OPERATORS);
      this.currInpType = "text";
    } else if (attrType.startsWith("enum")) {
      this.addOperators(ENUM_OPERATORS);
    } else if (attrType == "datetime") {
      this.addOperators(DATETIME_OPERATORS);
      let opt = {
        defaultDate: new Date(),
        enableTime: true,
        enableSeconds: true,
        time_24hr: true,
        minDate: this._g.userPrefs.dbQueryTimeRange.start.getValue(),
        maxDate: this._g.userPrefs.dbQueryTimeRange.end.getValue(),
      };
      if (unixDateValue) {
        opt.defaultDate = new Date(unixDateValue);
      }

      // view child gives undefined
      setTimeout(() => {
        flatpickr(this.dateInp.nativeElement, opt);
      }, 0);
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

    if (atType == "datetime") {
      value =
        this.dateInp.nativeElement["_flatpickr"].selectedDates[0].getTime();
      rawValue = value;
    } else if (atType == "int") {
      value = parseInt(value);
    } else if (atType == "float") {
      value = parseFloat(value);
    }

    if (this.selectedOperatorKey === this.ONE_OF) {
      value = this.filterInp;
    }

    let mapped = undefined;
    if (this.finiteSetPropertyMap) {
      const o = this.finiteSetPropertyMap.find((x) => x.key == this.filterInp);
      if (o) {
        mapped = o.value;
      }
      if (this.selectedOperatorKey === this.ONE_OF) {
        mapped = "";
        const arr = this.filterInp.split(",");
        for (const el of arr) {
          const o = this.finiteSetPropertyMap.find((x) => x.key == el);
          if (o) {
            mapped += o.value + ",";
          }
        }
        const strSize = mapped.length;
        if (strSize > 0 && mapped[strSize - 1] === ",") {
          mapped = mapped.substr(0, strSize - 1);
        }
      }
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
      enumMapping: mapped,
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
    this.currListName = "New list";
    this.currSelectedList = null;
    this.fillFittingSavedLists();
    this.currInpType = "text";
    if (typeof this.filterInp !== "string") {
      this.filterInp = "" + this.filterInp;
    }
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      const arr = this.filterInp.split(",");
      for (const o of this.finiteSetPropertyMap) {
        this.option2selected[o.key] = arr.includes(o.key);
      }
    } else {
      this.textAreaInp = this.filterInp.split(",").join("\n");
    }
  }

  optSelected() {
    this.filterInp = this.optInp;
  }

  txtAreaPopupOk() {
    if (
      this.selectedOperatorKey == this.ONE_OF &&
      this.selectedPropertyCategory == PropertyCategory.finiteSet
    ) {
      const selectedOptions = [
        ...this.multiSelect.nativeElement.querySelectorAll("option"),
      ]
        .filter((x) => x.selected)
        .map((x) => x.value);
      this.filterInp = selectedOptions.join(",");
    } else {
      this.filterInp = this.textAreaInp.trim().split("\n").join(",");
    }
    this.isShowTxtArea = false;
  }

  txtAreaPopupCancel() {
    this.textAreaInp = this.filterInp.split(",").join("\n");
    this.isShowTxtArea = false;
  }

  onMoveEnd(e) {
    this.position = e;
  }

  onResizeStop(e) {
    this.txtAreaSize = e.size;
  }

  saveCurrList() {
    let selectedOptions = this.textAreaInp
      .split("\n")
      .map((x) => new BehaviorSubject<string>(x));
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      selectedOptions = [
        ...this.multiSelect.nativeElement.querySelectorAll("option"),
      ]
        .filter((x) => x.selected)
        .map((x) => new BehaviorSubject<string>(x.value));
    }
    const isNum = this.isNumberProperty();
    // the button to fire this function will only be visible when operator is 'one of'
    let theLists: {
      name: BehaviorSubject<string>;
      values: BehaviorSubject<string>[];
    }[] = null;
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      theLists = this._g.userPrefs.savedLists.enumLists;
    } else if (isNum) {
      theLists = this._g.userPrefs.savedLists.numberLists;
    } else {
      theLists = this._g.userPrefs.savedLists.stringLists;
    }
    const idx = theLists.findIndex(
      (x) => x.name.getValue() == this.currListName
    );
    if (idx > -1) {
      theLists[idx].values = selectedOptions;
    } else {
      theLists.push({
        name: new BehaviorSubject<string>(this.currListName),
        values: selectedOptions,
      });
    }
    this.currSelectedList = this.currListName;
    this._profile.saveUserPrefs();
    this.fillFittingSavedLists();
  }

  deleteList() {
    const isNum = this.isNumberProperty();
    // the button to fire this function will only be visible when operator is 'one of'
    let theLists: {
      name: BehaviorSubject<string>;
      values: BehaviorSubject<string>[];
    }[] = null;
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      theLists = this._g.userPrefs.savedLists.enumLists;
    } else if (isNum) {
      theLists = this._g.userPrefs.savedLists.numberLists;
    } else {
      theLists = this._g.userPrefs.savedLists.stringLists;
    }
    const idx = theLists.findIndex(
      (x) => x.name.getValue() == this.currSelectedList
    );
    if (idx > -1) {
      theLists.splice(idx, 1);
    }
    this.currListName = "";
    this._profile.saveUserPrefs();
    this.fillFittingSavedLists();
  }

  changeSelectedSavedList(t: EventTarget) {
    let ev = (<HTMLInputElement>t).value;
    this.currListName = ev;
    let savedList: BehaviorSubject<string>[] = [];
    const isNum = this.isNumberProperty();
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      savedList = this._g.userPrefs.savedLists.enumLists.find(
        (x) => x.name.getValue() === ev
      ).values;
    } else if (isNum) {
      savedList = this._g.userPrefs.savedLists.numberLists.find(
        (x) => x.name.getValue() === ev
      ).values;
    } else {
      savedList = this._g.userPrefs.savedLists.stringLists.find(
        (x) => x.name.getValue() === ev
      ).values;
    }
    if (this.selectedPropertyCategory == PropertyCategory.finiteSet) {
      for (const i in this.option2selected) {
        this.option2selected[i] = false;
      }
      for (const i of savedList) {
        this.option2selected[i.getValue()] = true;
      }
    } else {
      this.textAreaInp = savedList.map((x) => x.getValue()).join("\n");
    }
  }

  private fillFittingSavedLists() {
    this.fittingSavedLists.length = 0;
    const l = this._g.userPrefs.savedLists;
    const isNum = this.isNumberProperty();
    if (this.selectedPropertyCategory === PropertyCategory.finiteSet) {
      this.fittingSavedLists = l.enumLists.map((x) => x.name.getValue());
    } else if (isNum) {
      this.fittingSavedLists = l.numberLists.map((x) => x.name.getValue());
    } else {
      this.fittingSavedLists = l.stringLists.map((x) => x.name.getValue());
    }
  }

  private addOperators(op) {
    for (let [k, v] of Object.entries(op)) {
      this.operators[k] = v;
      this.operatorKeys.push(k);
    }
  }

  private getPropertyCategory(): PropertyCategory {
    let m = this._g.getEnumMapping();
    this.finiteSetPropertyMap = null;
    if (
      m &&
      m[this.selectedClass] &&
      m[this.selectedClass][this.selectedProp]
    ) {
      this.finiteSetPropertyMap = m[this.selectedClass][this.selectedProp];
      const arr = [];
      for (const k in this.finiteSetPropertyMap) {
        arr.push({ key: k, value: this.finiteSetPropertyMap[k] });
      }
      arr.sort((a: any, b: any) => {
        if (a.value > b.value) return 1;
        if (b.value > a.value) return -1;
        return 0;
      });
      this.finiteSetPropertyMap = arr;
      return PropertyCategory.finiteSet;
    }
    if (this.attributeType == "datetime") {
      return PropertyCategory.date;
    }
    return PropertyCategory.other;
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
    const inp = rule.inputOperand;
    // property, operator are selected so an input must be provided
    if (inp === undefined || inp === null) {
      return false;
    }
    const t = rule.propertyType;
    if (
      (t == "datetime" || t == "float" || t == "int") &&
      !isNumber(inp) &&
      this.selectedOperatorKey != this.ONE_OF
    ) {
      return false;
    }
    return true;
  }
}
