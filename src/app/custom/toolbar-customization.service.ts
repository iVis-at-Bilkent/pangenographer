import { Injectable } from "@angular/core";
import { GlobalVariableService } from "../visuall/global-variable.service";
import { ToolbarDiv } from "../visuall/toolbar/itoolbar";

@Injectable({
  providedIn: "root",
})
/** Custom menu items and action functions for the items should be added to this class.
 * You might need to import other services but you should only edit this file.
 * Using 'menu' function, provided items will be added to toolbar.
 * 'isStd' property must be false for all items.
 * If 'dropdown' is not existing inside standard menu, it will be added as a new item.
 sample menu   
    this._menu = [{
      div: 12, items: [{ title: 'Custom Action 1', isRegular: true, fn: 'fn1', isStd: false, imgSrc: '' }]
    },
    {
      div: 1, items: [{ title: 'Custom Action 2', isRegular: true, fn: 'fn2', isStd: false, imgSrc: '' }]
    }];
**/
export class ToolbarCustomizationService {
  private _menu: ToolbarDiv[];
  get menu(): ToolbarDiv[] {
    return this._menu;
  }

  constructor(private _g: GlobalVariableService) {
    this._menu = [];

    // this._menu = [{
    //   div: 12, items: [{ title: 'Custom Action 1', isRegular: true, fn: 'fn1', isStd: false, imgSrc: 'assets/img/logo.png' }]
    // },
    // {
    //   div: 1, items: [{ title: 'Custom Action 2', isRegular: true, fn: 'fn2', isStd: false, imgSrc: 'assets/img/logo.png' }]
    // }];
  }

  // fn1() { console.log('fn1 is called!') }

  // fn2() { console.log('fn2 is called!') }
}
