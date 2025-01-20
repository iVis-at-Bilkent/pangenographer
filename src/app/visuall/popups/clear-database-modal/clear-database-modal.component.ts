import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
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
  @Input() clearDatabase: boolean = true; // Clear database by default

  constructor(
    public activeModal: NgbActiveModal,
    public _cyService: CytoscapeService
  ) {}

  ngAfterViewChecked() {
    this.closeBtnRef.nativeElement.blur();
  }

  clear() {
    this._cyService.clear(this.clearDatabase);
    this.activeModal.dismiss();
  }

  cancel() {
    this.activeModal.dismiss();
  }
}
