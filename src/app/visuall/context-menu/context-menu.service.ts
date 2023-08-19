import { Injectable } from "@angular/core";
import cytoscape from "cytoscape";
import * as contextMenus from "cytoscape-context-menus";
import { CytoscapeService } from "../cytoscape.service";
import { GlobalVariableService } from "../global-variable.service";
import { DbAdapterService } from "../db-service/db-adapter.service";
import { ContextMenuItem } from "./icontext-menu";
import { ContextMenuCustomizationService } from "../../custom/context-menu-customization.service";
import { COLLAPSED_EDGE_CLASS, CLUSTER_CLASS } from "./../constants";

@Injectable({
  providedIn: "root",
})
export class ContextMenuService {
  menu: ContextMenuItem[];

  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _customizationService: ContextMenuCustomizationService,
    private _dbService: DbAdapterService
  ) {
    this.menu = [
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
        id: "DownStream",
        content: "DownStream",
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
        onClickFunction: this.deleteElem.bind(this),
      },
    ];
  }

  bindContextMenuExtension() {
    // register context menu extension
    cytoscape.use(contextMenus);
    this.menu = this._customizationService.menu.concat(this.menu);
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

  deleteElem(event) {
    this._cyService.deleteSelected(event);
  }

  deleteSelected() {
    this._cyService.deleteSelected(false);
  }

  performLayout() {
    this._g.performLayout(false, true);
  }

  selectAllThisType(event) {
    const ele = event.target || event.cyTarget;
    if (!ele) {
      return;
    }
    const model = this._g.dataModel.getValue();
    const classes = ele.className();
    for (let c of classes) {
      if (model.nodes[c] || model.edges[c]) {
        this._g.cy.$("." + c).select();
      }
    }
  }

  collapseEdges(event) {
    const ele = event.target || event.cyTarget;
    if (!ele) {
      return;
    }
    this._cyService.collapseMultiEdges(ele.parallelEdges());
  }

  expandEdge(event) {
    const ele = event.target || event.cyTarget;
    if (!ele) {
      return;
    }
    this._cyService.expandMultiEdges(ele);
  }

  showUpstream(event) {
    this.showUpDownstream(event, true);
  }

  showDownstream(event) {
    this.showUpDownstream(event, false);
  }

  showUpDownstream(event, isUp: boolean) {
    const ele = event.target || event.cyTarget;
    if (!ele) {
      return;
    }
    this._cyService.showUpDownStream(ele, this._g.userPrefs.pangenograph.lengthOfUpDownstream.getValue(), isUp);
  }

  hideUpstream(event) {
    this.hideUpDownstream(event, true);
  }

  hideDownstream(event) {
    this.hideUpDownstream(event, false);
  }

  hideUpDownstream(event, isUp) {
    const ele = event.target || event.cyTarget;
    if (!ele) {
      return;
    }
    const callback = (data) => {
      this._cyService.deleteElements(data, ele.data().segmentName);
    };
    this._g.layout.clusters = null;
    this._dbService.getElementsUpToCertainDistance(
      ele.data().segmentName,
      this._g.userPrefs.pangenograph.lengthOfUpDownstream.getValue(),
      callback,
      isUp
    );
    this._g.performLayout(false);
  }
}
