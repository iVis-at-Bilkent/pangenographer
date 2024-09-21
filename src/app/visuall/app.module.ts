import { APP_BASE_HREF } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { RouterModule } from "@angular/router";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { AngularDraggableModule } from "angular2-draggable";
import { AutoSizeInputModule } from "ngx-autosize-input";
import { SharedModule } from "../shared/shared.module";
import { AppComponent } from "./app.component";
import { ColorPickerComponent } from "./color-picker/color-picker.component";
import { CytoscapeComponent } from "./cytoscape/cytoscape.component";
import { GraphHistoryComponent } from "./graph-history/graph-history.component";
import { NavbarComponent } from "./navbar/navbar.component";
import { BlastTabComponent } from "./operation-tabs/map-tab/blast-tab/blast-tab.component";
import { GraphTheoreticPropertiesTabComponent } from "./operation-tabs/map-tab/graph-theoretic-properties-tab/graph-theoretic-properties-tab.component";
import { GroupTabComponent } from "./operation-tabs/map-tab/group-tab/group-tab.component";
import { MapTabComponent } from "./operation-tabs/map-tab/map-tab.component";
import { ObjectTabComponent } from "./operation-tabs/object-tab/object-tab.component";
import { OperationTabsComponent } from "./operation-tabs/operation-tabs.component";
import { AdvancedQueriesComponent } from "./operation-tabs/query-tab/advanced-queries/advanced-queries.component";
import { SearchSegmentByNameComponent } from "./operation-tabs/query-tab/custom-queries/search-segment-by-name/search-segment-by-name.component";
import { SearchSegmentByNucleotideSequenceComponent } from "./operation-tabs/query-tab/custom-queries/search-segment-by-nucleotide-sequence/search-segment-by-nucleotide-sequence.component";
import { QueryTabComponent } from "./operation-tabs/query-tab/query-tab.component";
import { SettingsTabComponent } from "./operation-tabs/settings-tab/settings-tab.component";
import { PanelContainerComponent } from "./panel-container/panel-container.component";
import { AboutModalComponent } from "./popups/about-modal/about-modal.component";
import { ClearDatabaseModalComponent } from "./popups/clear-database-modal/clear-database-modal.component";
import { ErrorModalComponent } from "./popups/error-modal/error-modal.component";
import { LoadGraphFromFileModalComponent } from "./popups/load-graph-from-file-modal/load-graph-from-file-modal.component";
import { QuickHelpModalComponent } from "./popups/quick-help-modal/quick-help-modal.component";
import { SaveAsPngModalComponent } from "./popups/save-as-png-modal/save-as-png-modal.component";
import { SaveProfileModalComponent } from "./popups/save-profile-modal/save-profile-modal.component";
import { PropertyRuleComponent } from "./property-rule/property-rule.component";
import { RuleDropdownComponent } from "./rule-dropdown/rule-dropdown.component";
import { RuleTreeComponent } from "./rule-tree/rule-tree.component";
import { ToolbarComponent } from "./toolbar/toolbar.component";

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    ToolbarComponent,
    ClearDatabaseModalComponent,
    OperationTabsComponent,
    CytoscapeComponent,
    SaveAsPngModalComponent,
    QuickHelpModalComponent,
    AboutModalComponent,
    ObjectTabComponent,
    MapTabComponent,
    SettingsTabComponent,
    QueryTabComponent,
    GroupTabComponent,
    ColorPickerComponent,
    PropertyRuleComponent,
    ErrorModalComponent,
    GraphTheoreticPropertiesTabComponent,
    GraphHistoryComponent,
    SaveProfileModalComponent,
    AdvancedQueriesComponent,
    RuleTreeComponent,
    RuleDropdownComponent,
    PanelContainerComponent,
    LoadGraphFromFileModalComponent,
    BlastTabComponent,
    SearchSegmentByNameComponent,
    SearchSegmentByNucleotideSequenceComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    AutoSizeInputModule,
    AngularDraggableModule,
    SharedModule,
    RouterModule.forRoot([]),
  ],
  providers: [{ provide: APP_BASE_HREF, useValue: "/" }],
  bootstrap: [AppComponent],
  entryComponents: [
    SaveAsPngModalComponent,
    QuickHelpModalComponent,
    AboutModalComponent,
    ErrorModalComponent,
    ClearDatabaseModalComponent,
  ],
})
export class AppModule {}
