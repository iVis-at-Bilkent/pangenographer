import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { GlobalVariableService } from "../global-variable.service";
import { MapTabComponent } from "./map-tab/map-tab.component";
import { ObjectTabComponent } from "./object-tab/object-tab.component";
import { QueryTabComponent } from "./query-tab/query-tab.component";
import { SettingsTabComponent } from "./settings-tab/settings-tab.component";

@Component({
  selector: "app-operation-tabs",
  templateUrl: "./operation-tabs.component.html",
  styleUrls: ["./operation-tabs.component.css"],
})
export class OperationTabsComponent implements OnDestroy {
  currTab: Number;
  tabs: { component: any; text: string }[] = [
    { component: ObjectTabComponent, text: "Object" },
    { component: MapTabComponent, text: "Map" },
    { component: QueryTabComponent, text: "Database" },
    { component: SettingsTabComponent, text: "Settings" },
  ];
  tabChangeSubscription: Subscription;

  constructor(private _g: GlobalVariableService) {
    this.currTab = this._g.operationTabChanged.getValue();
    this.tabChangeSubscription = this._g.operationTabChanged.subscribe((x) => {
      this.currTab = x;
    });
  }

  setTab(i: number) {
    this._g.operationTabChanged.next(i);
  }

  ngOnDestroy(): void {
    if (this.tabChangeSubscription) {
      this.tabChangeSubscription.unsubscribe();
    }
  }
}
