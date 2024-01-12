import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SharedModule } from "../shared/shared.module";
import { DbService } from "../visuall/db-service/data-types";
import { Neo4jDb } from "../visuall/db-service/neo4j-db.service";
import {
  Rule,
  RuleNode,
  TimebarMetric,
} from "../visuall/operation-tabs/map-tab/query-types";
import { Query0Component } from "./queries/query0/query0.component";
import { Query1Component } from "./queries/query1/query1.component";

// import { AsdComponent } from './asd/asd.component';
// import statements for custom components should be here

@NgModule({
  // custom components should be inside declarations
  declarations: [Query0Component, Query1Component],
  // declarations: [AsdComponent],
  imports: [CommonModule, SharedModule, FormsModule],
})
export class CustomizationModule {
  // static operationTabs: { component: any, text: string }[] = [{ component: AsdComponent, text: 'Dummy' }];
  // static operationTabs: { component: any, text: string }[] = [{ component: AsdComponent, text: 'Dummy' }, { component: Dummy2Component, text: 'Dummy2' }];
  static operationTabs: { component: any; text: string }[] = [];
  static objSubTabs: { component: any; text: string }[] = [];
  static mapSubTabs: { component: any; text: string }[] = [];
  static databaseSubTabs: { component: any; text: string }[] = [];
  static settingsSubTabs: { component: any; text: string }[] = [];
  static queries: { component: any; text: string }[] = [
    { component: Query0Component, text: "Get actors by title counts" },
    { component: Query1Component, text: "Get titles by genre" },
  ];
  static db: DbService;
  static defaultTimebarMetrics: TimebarMetric[];
  constructor(private _db: Neo4jDb) {
    CustomizationModule.db = _db;

    const andCond: Rule = { ruleOperator: "AND" };
    const genreCond: Rule = {
      propertyOperand: "genres",
      propertyType: "list",
      rawInput: "Comedy",
      inputOperand: "Comedy",
      ruleOperator: null,
      operator: "In",
    };
    const lowRateCond: Rule = {
      propertyOperand: "rating",
      propertyType: "float",
      rawInput: "5.5",
      inputOperand: "5.5",
      ruleOperator: null,
      operator: "<=",
    };
    const higRateCond: Rule = {
      propertyOperand: "rating",
      propertyType: "float",
      rawInput: "7.5",
      inputOperand: "7.5",
      ruleOperator: null,
      operator: ">=",
    };

    const root1: RuleNode = { r: andCond, parent: null, children: [] };
    const root2: RuleNode = { r: andCond, parent: null, children: [] };
    const child1: RuleNode = { r: genreCond, parent: root1, children: [] };
    const child2: RuleNode = { r: lowRateCond, parent: root1, children: [] };
    const child3: RuleNode = { r: genreCond, parent: root2, children: [] };
    const child4: RuleNode = { r: higRateCond, parent: root2, children: [] };

    root1.children = [child1, child2];
    root2.children = [child3, child4];
    CustomizationModule.defaultTimebarMetrics = [
      {
        incrementFn: null,
        name: "lowly rated comedies",
        className: "Title",
        rules: root1,
        color: "#3366cc",
      },
      {
        incrementFn: null,
        name: "highly rated comedies",
        className: "Title",
        rules: root2,
        color: "#ff9900",
      },
    ];
  }
}
