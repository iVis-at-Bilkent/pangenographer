import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Subscription } from "rxjs";
import { GlobalVariableService } from "../../global-variable.service";

@Component({
  selector: "app-about-modal",
  templateUrl: "./about-modal.component.html",
  styleUrls: ["./about-modal.component.css"],
})
export class AboutModalComponent
  implements OnInit, AfterViewChecked, OnDestroy
{
  @ViewChild("closeBtn", { static: false }) closeButtonRef: ElementRef;
  toolName: string;
  softwareVersion: string;
  buildTime: string;
  toolLogo: string;
  companyName: string;
  companyContact: string;
  subs: Subscription;

  constructor(
    public activeModal: NgbActiveModal,
    private _g: GlobalVariableService
  ) {}

  ngOnInit() {
    this.subs = this._g.appDescription.subscribe((x) => {
      if (x) {
        this.toolName = x.appInfo.name;
        this.softwareVersion = x.appInfo.version;
        this.toolLogo = x.appInfo.icon;
        this.companyContact = x.appInfo.company_contact;
        this.buildTime = x.appInfo.build_time;
      }
    });
  }

  ngAfterViewChecked() {
    this.closeButtonRef.nativeElement.blur();
  }

  ngOnDestroy(): void {
    if (this.subs) {
      this.subs.unsubscribe();
    }
  }
}
