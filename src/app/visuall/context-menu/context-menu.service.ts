import { Injectable } from "@angular/core";
import cytoscape from "cytoscape";
import * as contextMenus from "cytoscape-context-menus";
import { CytoscapeService } from "../cytoscape.service";
import { DbAdapterService } from "../db-service/db-adapter.service";
import { GlobalVariableService } from "../global-variable.service";
import { CLUSTER_CLASS, COLLAPSED_EDGE_CLASS } from "./../constants";
import { ContextMenuItem } from "./icontext-menu";

@Injectable({
  providedIn: "root",
})
export class ContextMenuService {
  menu: ContextMenuItem[];

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _dbService: DbAdapterService
  ) {
    this.menu = [
      {
        id: "getAllZeroDegreeNodes",
        content: "Get All Zero Degree Nodes",
        coreAsWell: true,
        onClickFunction: () => {
          this._cyService.getAllZeroDegreeNodes();
        },
      },
      {
        id: "getAllZeroIncomingDegreeNodes",
        content: "Get All Zero Incoming Degree Nodes",
        coreAsWell: true,
        onClickFunction: () => {
          this._cyService.getAllZeroIncomingDegreeNodes();
        },
      },
      {
        id: "getAllZeroOutgoingDegreeNodes",
        content: "Get All Zero Outgoing Degree Nodes",
        coreAsWell: true,
        onClickFunction: () => {
          this._cyService.getAllZeroOutgoingDegreeNodes();
        },
      },
      {
        id: "collapseAllNodes",
        content: "Collapse All Nodes",
        coreAsWell: true,
        onClickFunction: () => {
          this._cyService.collapseNodes();
        },
      },
      {
        id: "collapseAllEdges",
        content: "Collapse All Edges",
        coreAsWell: true,
        onClickFunction: () => {
          this._cyService.collapseMultiEdges();
        },
      },
      {
        id: "performLayout",
        content: "Perform Layout",
        coreAsWell: true,
        onClickFunction: this.performLayout.bind(this),
      },
      {
        id: "deleteSelected",
        content: "Delete Selected",
        coreAsWell: true,
        onClickFunction: this.deleteSelected.bind(this),
      },
      {
        id: "Upstream",
        content: "Upstream",
        selector: "node",
        submenu: [
          {
            id: "showUpstream",
            content: "Show Upstream",
            selector: "node",
            onClickFunction: this.showUpstream.bind(this),
          },
          {
            id: "hideUpstream",
            content: "Hide Upstream",
            selector: "node",
            onClickFunction: this.hideUpstream.bind(this),
          },
        ],
      },
      {
        id: "Downstream",
        content: "Downstream",
        selector: "node",
        submenu: [
          {
            id: "showDownstream",
            content: "Show Downstream",
            selector: "node",
            onClickFunction: this.showDownstream.bind(this),
          },
          {
            id: "hideDownstream",
            content: "Hide Downstream",
            selector: "node",
            onClickFunction: this.hideDownstream.bind(this),
          },
        ],
      },
      {
        id: "selectObjectsOfThisType",
        content: "Select Objects of This Type",
        selector: "node,edge",
        onClickFunction: this.selectAllThisType.bind(this),
      },
      {
        id: "collapseEdge",
        content: "Collapse",
        selector: "[^collapsedEdges][^originalEnds]",
        onClickFunction: this.collapseEdges.bind(this),
      },
      {
        id: "expandEdge",
        content: "Expand",
        selector: "edge." + COLLAPSED_EDGE_CLASS + "[^originalEnds]", // don't expand meta edges
        onClickFunction: this.expandEdge.bind(this),
      },
      {
        id: "removeGroup",
        content: "Remove Group",
        selector: "node." + CLUSTER_CLASS,
        onClickFunction: (e) => {
          this._cyService.removeGroup4Selected(e.target || e.cyTarget);
        },
      },
      {
        id: "deleteElement",
        content: "Delete",
        selector: "node,edge",
        onClickFunction: this.deleteElement.bind(this),
      },
    ];
  }

  bindContextMenuExtension() {
    // register context menu extension
    cytoscape.use(contextMenus);
    this._g.cy.contextMenus({
      menuItems: this.menu,
      menuItemClasses: ["vall-ctx-menu-item"],
      contextMenuClasses: ["vall-ctx-menu"],
      submenuIndicator: {
        src: "https://raw.githubusercontent.com/iVis-at-Bilkent/cytoscape.js-context-menus/97877acfa77914ee01c4c74c12b0e1ccc362852d/assets/submenu-indicator-default.svg",
        width: 12,
        height: 12,
      },
    });
  }

  deleteElement(event: any) {
    this._cyService.deleteSelected(event);
  }

  deleteSelected() {
    this._cyService.deleteSelected(false);
  }

  performLayout() {
    this._g.performLayout(false, true);
  }

  selectAllThisType(event: any) {
    const element = event.target || event.cyTarget;
    if (!element) {
      return;
    }
    const model = this._g.dataModel.getValue();
    const classes = element.className();
    for (let c of classes) {
      if (model.nodes[c] || model.edges[c]) {
        this._g.cy.$("." + c).select();
      }
    }
  }

  collapseEdges(event: any) {
    const element = event.target || event.cyTarget;
    if (!element) {
      return;
    }
    this._cyService.collapseMultiEdges(element.parallelEdges());
  }

  expandEdge(event: any) {
    const element = event.target || event.cyTarget;
    if (!element) {
      return;
    }
    this._cyService.expandMultiEdges(element);
  }

  showUpstream(event: any) {
    this.showUpDownstream(event, true);
  }

  showDownstream(event: any) {
    this.showUpDownstream(event, false);
  }

  showUpDownstream(event: any, isUp: boolean) {
    const element = event.target || event.cyTarget;
    if (!element) {
      return;
    }
    this._cyService.showUpDownstream(
      element.id().substring(1), // remove the first character which is 'n' or 'e' to get the id stored in the database
      this._g.userPreferences.lengthOfUpDownstream.getValue(),
      isUp
    );
  }

  hideUpstream(event: any) {
    this.hideUpDownstream(event, true);
  }

  hideDownstream(event: any) {
    this.hideUpDownstream(event, false);
  }

  hideUpDownstream(event: any, isUp: boolean) {
    const element = event.target || event.cyTarget;
    if (!element) {
      return;
    }

    const callback = (data: any) => {
      this._cyService.deleteElements(data, element.data().segmentName);
    };

    this._g.layout.clusters = null;

    this._dbService.getElementsUpToCertainDistance(
      element.id().substring(1), // remove the first character which is 'n' or 'e' to get the id stored in the database
      this._g.userPreferences.lengthOfUpDownstream.getValue(),
      callback,
      isUp
    );
  }
}
