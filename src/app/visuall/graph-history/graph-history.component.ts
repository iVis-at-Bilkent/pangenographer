import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { GraphHistoryItem } from "../db-service/data-types";
import { GlobalVariableService } from "../global-variable.service";

@Component({
  selector: "app-graph-history",
  templateUrl: "./graph-history.component.html",
  styleUrls: ["./graph-history.component.css"],
})
export class GraphHistoryComponent implements OnInit, OnDestroy {
  isShow: boolean = false;
  imgSrc: string = null;
  graphHistory: GraphHistoryItem[];
  position = { x: -130, y: 0 };
  currSize: { width: number; height: number } = { width: 375, height: 600 };
  activeItemIdx = 0;
  subs: Subscription[] = [];

  constructor(private _g: GlobalVariableService) {}

  ngOnInit(): void {
    this.graphHistory = this._g.graphHistory;
    this.subs.push(
      this._g.showHideGraphHistory.subscribe((x) => {
        this.isShow = x;
        if (x) {
          this.graphHistory = this._g.graphHistory;
        }
      })
    );
    this.subs.push(
      this._g.addNewGraphHistoryItem.subscribe((x) => {
        if (x) {
          this.activeItemIdx = this._g.graphHistory.length - 1;
        }
      })
    );
    this.subs.push(
      this._g.userPrefs.queryHistoryLimit.subscribe((x) => {
        while (this._g.graphHistory.length > x) {
          this._g.graphHistory.splice(0, 1);
          this.activeItemIdx = this.activeItemIdx - 1;
        }
        this.graphHistory = this._g.graphHistory;
      })
    );
  }

  ngOnDestroy(): void {
    if (this.subs) {
      for (const sub of this.subs) {
        sub.unsubscribe();
      }
      this.subs = [];
    }
  }

  load(i: number) {
    this.activeItemIdx = i;
    let g = this.graphHistory[i];
    this._g.cy.json({ elements: g.json });
    this._g.isLoadFromHistory = true;
    this._g.cy.fit();
  }

  delete(i: number) {
    if (i == this.activeItemIdx) {
      this.activeItemIdx = -1;
    }
    if (i < this.activeItemIdx) {
      this.activeItemIdx = this.activeItemIdx - 1;
    }
    this._g.graphHistory.splice(i, 1);
  }

  onMouseOver(i: number) {
    this.imgSrc = this._g.graphHistory[i].base64png;
  }

  onMouseOut() {
    this.imgSrc = null;
  }

  closeClicked() {
    this._g.showHideGraphHistory.next(false);
    this.imgSrc = null;
  }

  onMoveEnd(e) {
    this.position = e;
  }

  onResizeStop(e) {
    this.currSize = e.size;
  }
}
