import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  Input,
  OnDestroy,
} from "@angular/core";
import { GlobalVariableService } from "../../visuall/global-variable.service";
import { Subscription } from "rxjs";
import { TYPES_NOT_TO_SHOW } from "src/app/visuall/constants";
@Component({
  selector: "app-types-view",
  templateUrl: "./types-view.component.html",
  styleUrls: ["./types-view.component.css"],
})
export class TypesViewComponent implements OnInit, OnDestroy {
  nodeClasses: Set<string>;
  showNodeClass = {};
  edgeClasses: Set<string>;
  showEdgeClass = {};
  @Output() onFilterByType = new EventEmitter<{
    className: string;
    willBeShowed: boolean;
  }>();
  @Input() classList: string[];
  dataModelSubs: Subscription;

  constructor(private _g: GlobalVariableService) {
    this.nodeClasses = new Set([]);
    this.edgeClasses = new Set([]);
  }

  ngOnInit(): void {
    this.dataModelSubs = this._g.dataModel.subscribe((x) => {
      if (x) {
        for (const key in x.nodes) {
          if (
            (!this.classList || this.classList.includes(key)) &&
            !TYPES_NOT_TO_SHOW.includes(key)
          ) {
            this.nodeClasses.add(key);
            this.showNodeClass[key] = true;
          }
        }

        for (const key in x.edges) {
          if (
            (!this.classList || this.classList.includes(key)) &&
            !TYPES_NOT_TO_SHOW.includes(key)
          ) {
            this.edgeClasses.add(key);
            this.showEdgeClass[key] = true;
          }
        }
      }
    });
  }

  filterElesByClass(className: string, isNode: boolean) {
    let willBeShowed = false;
    if (isNode) {
      this.showNodeClass[className] = !this.showNodeClass[className];
      willBeShowed = this.showNodeClass[className];
    } else {
      this.showEdgeClass[className] = !this.showEdgeClass[className];
      willBeShowed = this.showEdgeClass[className];
    }
    this.onFilterByType.next({
      className: className,
      willBeShowed: willBeShowed,
    });
  }

  ngOnDestroy(): void {
    if (this.dataModelSubs) {
      this.dataModelSubs.unsubscribe();
    }
  }
}
