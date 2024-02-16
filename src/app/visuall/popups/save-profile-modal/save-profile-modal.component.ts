import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { UserProfileService } from "../../user-profile.service";

@Component({
  selector: "app-save-profile-modal",
  templateUrl: "./save-profile-modal.component.html",
  styleUrls: ["./save-profile-modal.component.css"],
})
export class SaveProfileModalComponent implements AfterViewChecked {
  constructor(
    public activeModal: NgbActiveModal,
    private _profile: UserProfileService
  ) {}
  @ViewChild("closeBtn", { static: false }) closeBtnRef: ElementRef;
  boolSettings = [
    {
      text: "Settings",
      isEnable: true,
    },
    {
      text: "Filtering rules",
      isEnable: true,
    },
  ];

  ngAfterViewChecked() {
    this.closeBtnRef.nativeElement.blur();
  }

  save2File() {
    this._profile.downloadProfileAsFile(
      ...this.boolSettings.map((x) => x.isEnable)
    );
    this.activeModal.dismiss();
  }
}
