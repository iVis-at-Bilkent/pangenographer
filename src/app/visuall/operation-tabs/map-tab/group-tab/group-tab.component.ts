import { Component, OnInit } from "@angular/core";
import { areSetsEqual } from "../../../constants";
import { CytoscapeService } from "../../../cytoscape.service";
import { GlobalVariableService } from "../../../global-variable.service";
@Component({
  selector: "app-group-tab",
  templateUrl: "./group-tab.component.html",
  styleUrls: ["./group-tab.component.css"],
})
export class GroupTabComponent implements OnInit {
  options: { name: string; fn: any }[];
  selectedOption: string;
  prevGraph: Set<string>;
  currGraph: Set<string>;

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this.options = [
      { name: "None", fn: null },
      {
        name: "By the Louvain modularity algorithm",
        fn: () => {
          this._cyService.louvainClustering();
        },
      },
      {
        name: "By the Markov clustering algorithm",
        fn: () => {
          this._cyService.markovClustering();
        },
      },
    ];

    this.selectedOption = this.options[0].name;
  }

  optionChanged() {
    const idx = this.options.findIndex((x) => x.name == this.selectedOption);
    this._cyService.expandAllCompounds();
    this._cyService.deleteClusteringNodes();
    if (idx > -1 && this.options[idx].fn) {
      this.options[idx].fn();
    }
    this._g.performLayout(false);
    this.setGraphState();
  }

  setGraphState() {
    this.prevGraph = this.currGraph;
    this.currGraph = this._g.getGraphElemSet();
  }

  public componentOpened() {
    this.setGraphState();
    // set radio to None because graph has changed
    if (!areSetsEqual(this.prevGraph, this.currGraph)) {
      this.selectedOption = this.options[0].name;
    }
  }
}
