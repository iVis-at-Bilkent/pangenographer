// DUMMY COMPONENT

import { Component, OnInit } from "@angular/core";

export interface ActorCountData {
  id: number;
  Actor: string;
  Count: number;
}
@Component({
  selector: "search-segment-by-nucleotide-sequence",
  templateUrl: "./search-segment-by-nucleotide-sequence.component.html",
  styleUrls: ["./search-segment-by-nucleotide-sequence.component.css"],
})
export class SearchSegmentByNucleotideSequenceComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
