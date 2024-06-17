import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { CytoscapeService } from "../../cytoscape.service";

@Component({
  selector: "app-clear-database-modal",
  templateUrl: "./clear-database-modal.component.html",
  styleUrls: ["./clear-database-modal.component.css"],
})
export class ClearDatabaseModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeBtnRef: ElementRef;

  constructor(
    public activeModal: NgbActiveModal,
    public _cyService: CytoscapeService
  ) {}

  ngAfterViewChecked() {
    this.closeBtnRef.nativeElement.blur();
  }

  clearDatabase() {
    this._cyService.clearDatabase();
    this.activeModal.dismiss();
  }

  cancel() {
    this.activeModal.dismiss();
  }
}
