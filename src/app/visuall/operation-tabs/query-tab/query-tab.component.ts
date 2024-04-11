import { Component, OnInit } from "@angular/core";

@Component({
  selector: "app-query-tab",
  templateUrl: "./query-tab.component.html",
  styleUrls: ["./query-tab.component.css"],
})
export class QueryTabComponent implements OnInit {
  queries: { component: any; text: string }[];
  selectedQuery: string;
  selectedIndex: number;

  constructor() {
    this.queries = [];
    this.selectedIndex = -1;
  }

  ngOnInit() {
    this.selectedQuery = "";
  }

  changeQuery(event: any) {
    this.selectedIndex = this.queries.findIndex(
      (x) => x.text == event.target.value
    );
  }
}
