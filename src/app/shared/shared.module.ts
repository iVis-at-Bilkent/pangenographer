import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReplacePipe,
  TableViewComponent,
} from "./table-view/table-view.component";
import { TypesViewComponent } from "./types-view/types-view.component";
import { ElemOfInterestComponent } from "./elem-of-interest/elem-of-interest.component";

import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { AngularDraggableModule } from "angular2-draggable";
import { AutoSizeInputModule } from "ngx-autosize-input";
import { FormsModule } from "@angular/forms";

@NgModule({
  declarations: [
    TableViewComponent,
    ReplacePipe,
    TypesViewComponent,
    ElemOfInterestComponent,
  ],

  imports: [
    CommonModule,
    NgbModule,
    AngularDraggableModule,
    AutoSizeInputModule,
    FormsModule,
  ],
  exports: [
    TableViewComponent,
    ReplacePipe,
    TypesViewComponent,
    ElemOfInterestComponent,
  ],
})
export class SharedModule {}
