import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "app-welcome-modal",
  templateUrl: "./welcome-modal.component.html",
})
export class WelcomeModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;

  constructor(public activeModal: NgbActiveModal) {}

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }
}
