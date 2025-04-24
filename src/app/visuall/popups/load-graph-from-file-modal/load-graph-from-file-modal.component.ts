import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { GlobalVariableService } from "../../global-variable.service";

@Component({
  selector: "app-load-graph-from-file-modal",
  templateUrl: "./load-graph-from-file-modal.component.html",
  styleUrls: ["./load-graph-from-file-modal.component.css"],
})
export class LoadGraphFromFileModalComponent implements AfterViewChecked {
  @Input() txt: string;
  isOverrideExisting = true;
  constructor(
    public activeModal: NgbActiveModal,
    public _g: GlobalVariableService
  ) {}
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }

  replace() {
    this._g.layout.clusters = null;
    this._g.cy.remove(this._g.cy.$());
    try {
      this._g.expandCollapseApi.loadJson(this.txt, this.isOverrideExisting);
      this.activeModal.dismiss();
    } catch (e) {
      this.activeModal.dismiss();
      this._g.showErrorModal("Load", "Cannot process provided JSON file!");
    }
  }
}
