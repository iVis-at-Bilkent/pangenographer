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
  previousGraph: Set<string>;
  currentGraph: Set<string>;

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
    const index = this.options.findIndex((x) => x.name == this.selectedOption);
    this._cyService.expandAllCompounds();
    this._cyService.deleteClusteringNodes();
    if (index > -1 && this.options[index].fn) {
      this.options[index].fn();
    }
    this._g.performLayout(false);
    this.setGraphState();
  }

  setGraphState() {
    this.previousGraph = this.currentGraph;
    this.currentGraph = this._g.getGraphElementSet();
  }

  public componentOpened() {
    this.setGraphState();
    // set radio to None because graph has changed
    if (!areSetsEqual(this.previousGraph, this.currentGraph)) {
      this.selectedOption = this.options[0].name;
    }
  }
}
