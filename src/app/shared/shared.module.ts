import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { AngularDraggableModule } from "angular2-draggable";
import { AutoSizeInputModule } from "ngx-autosize-input";
import { TableTooltipDirective } from "../shared/table-view/table-tooltip.directive";
import { ElementOfInterestComponent } from "./element-of-interest/element-of-interest.component";
import {
  ReplacePipe,
  TableViewComponent,
} from "./table-view/table-view.component";
import { TypesViewComponent } from "./types-view/types-view.component";

@NgModule({
  declarations: [
    TableViewComponent,
    ReplacePipe,
    TypesViewComponent,
    ElementOfInterestComponent,
    TableTooltipDirective,
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
    ElementOfInterestComponent,
  ],
})
export class SharedModule {}
