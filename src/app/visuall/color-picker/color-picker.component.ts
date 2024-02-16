import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import * as AColorPicker from "a-color-picker";
@Component({
  selector: "app-color-picker",
  templateUrl: "./color-picker.component.html",
  encapsulation: ViewEncapsulation.None,
  styleUrls: ["./color-picker.component.css"],
})
export class ColorPickerComponent implements OnInit {
  @Output() onColorSelected = new EventEmitter<string>();
  constructor(private _modalService: NgbModal) {}
  pickedColors: string[] = [];
  picker: AColorPicker.ACPController = null;
  @Input() currColor: string;

  ngOnInit() {}

  open(ev: MouseEvent, content) {
    ev.preventDefault();
    // style="width: 232px; height: 363px;"
    const fn = () => {
      this.onColorSelected.emit(this.currColor);
    };
    this._modalService
      .open(content, { windowClass: "picker-window", animation: true })
      .result.then(fn, fn);
    this.setPicker();
  }

  private setPicker() {
    this.picker = AColorPicker.from(".picker", {
      palette: this.pickedColors,
    })[0];
    this.picker.color = this.currColor;
    this.picker.off("change");
    this.picker.on("change", (_, color) => {
      this.currColor = AColorPicker.parseColor(color, "hex");
    });
    this.picker.off("coloradd");
    this.picker.on("coloradd", (_, color) => {
      this.pickedColors.push(AColorPicker.parseColor(color, "hex"));
    });
    this.picker.off("colorremove");
    this.picker.on("colorremove", (_, color) => {
      const c = AColorPicker.parseColor(color, "hex");
      const i = this.pickedColors.findIndex((x) => x == c);
      if (i > -1) {
        this.pickedColors.splice(i, 1);
      }
    });
  }
}
