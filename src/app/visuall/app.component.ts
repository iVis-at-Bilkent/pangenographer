import { Component } from "@angular/core";
import { GlobalVariableService } from "./global-variable.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent {
  isLoading = false;

  constructor(private _g: GlobalVariableService) {
    if (this.isBenchmarkUrl()) {
      this._g.operationTabChanged.next(2);
    }

    this._g.setLoadingStatus = (e) => {
      this.isLoading = e;
      window["IsVisuallLoading"] = e;
    };
  }

  private isBenchmarkUrl(): boolean {
    const href = window.location.href.toLowerCase();
    return href.includes("/benchmarks");
  }
}
