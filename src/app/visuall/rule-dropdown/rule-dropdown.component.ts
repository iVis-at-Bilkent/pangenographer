import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

@Component({
  selector: "app-rule-dropdown",
  templateUrl: "./rule-dropdown.component.html",
  styleUrls: ["./rule-dropdown.component.css"],
})
export class RuleDropdownComponent implements OnInit {
  @Input() isShowConditionBtn: boolean;
  @Output() btnClicked: EventEmitter<"AND" | "OR" | "C"> = new EventEmitter();
  isShowDropDown: boolean;

  constructor() {}

  ngOnInit(): void {}

  btnClick(t: "AND" | "OR" | "C") {
    this.isShowDropDown = false;
    this.btnClicked.next(t);
  }
}
