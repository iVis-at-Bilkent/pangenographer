import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "app-legend-modal",
  templateUrl: "./legend-modal.component.html",
  styleUrls: ["./legend-modal.component.css"],
})
export class LegendModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeBtnRef: ElementRef;

  constructor(public activeModal: NgbActiveModal) {}

  ngAfterViewChecked() {
    this.closeBtnRef.nativeElement.blur();
  }
}
