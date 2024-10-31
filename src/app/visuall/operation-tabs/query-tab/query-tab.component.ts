import { Component, OnInit } from "@angular/core";
import { SearchBySequenceChainComponent } from "./custom-queries/search-by-sequence-chain/search-by-sequence-chain.component";
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
        text: "Search segment by name",
      },
      {
        component: SearchSegmentByNucleotideSequenceComponent,
        text: "Search segment by sequence",
      },
      {
        component: SearchBySequenceChainComponent,
        text: "Search by sequence chain",
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
