import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class CyStyleCustomizationService {
  constructor() {}

  // The developer can inject their own styles
  // Below given a code sample
  // cy.style().selector('node.Person')
  //     .style({
  //   'label': (e) => {
  //     return e.data('primary_name') + ' - ' + e.data('birth_year');
  //   },
  //     }).update();
  public addCustomStyles(cy) {}
}
