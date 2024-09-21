import { Component, OnInit } from "@angular/core";
import { SearchSegmentByNameComponent } from "./custom-queries/search-segment-by-name/search-segment-by-name.component";
import { SearchSegmentByNucleotideSequenceComponent } from "./custom-queries/search-segment-by-nucleotide-sequence/search-segment-by-nucleotide-sequence.component";
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
    this.queries = [
      {
        component: SearchSegmentByNameComponent,
        text: "Search Segment by Name",
      },
      {
        component: SearchSegmentByNucleotideSequenceComponent,
        text: "Search Segment by Sequence",
      },
    ];
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
