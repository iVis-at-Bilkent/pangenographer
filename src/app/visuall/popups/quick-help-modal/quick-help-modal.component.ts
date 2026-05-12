import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { USER_GUIDE_URL } from "../../constants";

@Component({
  selector: "app-quick-help-modal",
  templateUrl: "./quick-help-modal.component.html",
  styleUrls: ["./quick-help-modal.component.css"],
})
export class QuickHelpModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;
  readonly userGuideUrl = USER_GUIDE_URL;

  constructor(public activeModal: NgbActiveModal) {}

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }
}
