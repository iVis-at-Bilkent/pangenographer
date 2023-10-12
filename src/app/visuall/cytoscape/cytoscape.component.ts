import { Component, OnInit, HostListener } from "@angular/core";
import { CytoscapeService } from "../cytoscape.service";
import { ContextMenuService } from "../context-menu/context-menu.service";
import { GlobalVariableService } from "../global-variable.service";

@Component({
  selector: "app-cytoscape",
  templateUrl: "./cytoscape.component.html",
  styleUrls: ["./cytoscape.component.css"],
})
export class CytoscapeComponent implements OnInit {
  constructor(
    private _g: GlobalVariableService,
    private _cyService: CytoscapeService,
    private _ctxMenuService: ContextMenuService
  ) {}
  cyClass = false;
  private keyDown = {
    Alt: false,
    Shift: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowRight: false,
    ArrowLeft: false,
  };

  ngOnInit() {
    this._cyService.initCy(document.getElementById("cy"));
    this._ctxMenuService.bindContextMenuExtension();
  }

  setClassForCyDiv(b: boolean) {
    this.cyClass = b;
  }

  @HostListener("document:keydown.delete", ["$event"])
  deleteHotKeyFn() {
    const activeElement = document.activeElement as any;
    if (
      activeElement.tagName == "INPUT" &&
      activeElement.value &&
      activeElement.value.length > 0
    ) {
      return;
    }
    this._cyService.deleteSelected(false);
  }

  @HostListener("document:keydown.control.a", ["$event"])
  selectAllHotKeyFn(event: KeyboardEvent) {
    const activeElement = document.activeElement as any;
    if (
      (activeElement.tagName == "INPUT" &&
        activeElement.value &&
        activeElement.value.length > 0) ||
      activeElement.tagName == "TEXTAREA"
    ) {
      return;
    }
    event.preventDefault();
    if (event.ctrlKey) {
      this._g.cy.$().not(":hidden, :transparent").select();
    }
  }

  @HostListener("document:keydown", ["$event"])
  moveSelectedWithArrowKeys(event: KeyboardEvent) {
    if (this.keyDown[event.key] === undefined) {
      return;
    }
    this.keyDown[event.key] = true;

    // alt + arrowleft in chrome goes back to previous page
    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      event.altKey
    ) {
      event.preventDefault();
    }

    // shouldn't go ahead if both Alt and Shift are pressed
    if (this.keyDown["Alt"] && this.keyDown["Shift"]) {
      return;
    }
    // normal
    let moveSpeed: number = 3;

    // slow
    if (this.keyDown["Alt"]) {
      moveSpeed = 1;
    }
    // fast
    else if (this.keyDown["Shift"]) {
      moveSpeed = 10;
    }

    // decide the shift values in x and y axes
    // based on key presses
    let dx: number = 0;
    let dy: number = 0;

    dx += this.keyDown["ArrowRight"] ? moveSpeed : 0;
    dx -= this.keyDown["ArrowLeft"] ? moveSpeed : 0;
    dy += this.keyDown["ArrowDown"] ? moveSpeed : 0;
    dy -= this.keyDown["ArrowUp"] ? moveSpeed : 0;

    // move selected by the shift values decided above
    this._g.cy.nodes(":selected").shift({
      x: dx,
      y: dy,
    });
  }
  // This listener is written for moving
  // selected elements with arrow keys facility
  @HostListener("document:keyup", ["$event"])
  setKeyDownValues(event: KeyboardEvent) {
    // if the key is down set corresponding value to false
    if (this.keyDown[event.key] !== undefined) {
      this.keyDown[event.key] = false;
    }
  }
}
