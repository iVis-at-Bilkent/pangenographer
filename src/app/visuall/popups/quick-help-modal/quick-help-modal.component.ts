import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "app-quick-help-modal",
  templateUrl: "./quick-help-modal.component.html",
  styleUrls: ["./quick-help-modal.component.css"],
})
export class QuickHelpModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;

  constructor(public activeModal: NgbActiveModal) {}

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }
}
