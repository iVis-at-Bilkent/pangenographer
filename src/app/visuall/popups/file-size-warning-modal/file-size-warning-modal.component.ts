import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "app-file-size-warning-modal",
  templateUrl: "./file-size-warning-modal.component.html",
  styleUrls: ["./file-size-warning-modal.component.css"],
})
export class FileSizeWarningModalComponent implements AfterViewChecked {
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;
  @Input() fileName: string = "";
  @Input() fileSizeMB: number = 0;

  constructor(public activeModal: NgbActiveModal) {}

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }

  continue() {
    this.activeModal.close(true); 
  }

  cancel() {
    this.activeModal.dismiss();
  }
}
