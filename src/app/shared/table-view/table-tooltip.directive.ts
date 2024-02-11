import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Renderer2,
} from "@angular/core";

@Directive({
  selector: "[table-tooltip]",
})
export class TableTooltipDirective {
  @Input("table-tooltip") tooltipText: any;
  tooltip: HTMLElement;
  onTooltip: boolean = false;
  onHost: boolean = false;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener("mouseenter") onMouseEnter() {
    this.onHost = true;
    if (!this.tooltip) {
      this.show();
    }
  }

  @HostListener("mouseleave") onMouseLeave() {
    this.onHost = false;
    this.hide();
  }

  show() {
    this.tooltip = this.renderer.createElement("span");

    this.renderer.appendChild(
      this.tooltip,
      this.renderer.createText(this.tooltipText)
    );

    this.renderer.appendChild(document.body, this.tooltip);

    this.renderer.addClass(this.tooltip, "table-tooltip");

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltip.getBoundingClientRect();

    const scrollPos =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    let top = hostPos.bottom;
    let left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;

    this.renderer.setStyle(this.tooltip, "top", `${top + scrollPos}px`);
    this.renderer.setStyle(this.tooltip, "left", `${left}px`);

    this.renderer.listen(this.tooltip, "mouseenter", () => {
      this.onTooltip = true;
    });

    this.renderer.listen(this.tooltip, "mouseleave", () => {
      this.onTooltip = false;
      this.hide();
    });
  }

  hide() {
    window.setTimeout(() => {
      if (this.tooltip && !this.onTooltip && !this.onHost) {
        this.renderer.removeChild(document.body, this.tooltip);
        this.tooltip = null;
      }
    }, 100);
  }
}
