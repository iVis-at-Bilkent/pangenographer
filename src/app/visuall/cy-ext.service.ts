import { Injectable } from "@angular/core";
import navigator from "cytoscape-navigator";
import fcose from "cytoscape-fcose";
import popper from "cytoscape-popper";
import expandCollapse from "cytoscape-expand-collapse";
import viewUtilities from "cytoscape-view-utilities";
import layoutUtilities from "cytoscape-layout-utilities";
import cytoscapeVisualCues from "../../lib/cytoscape-visual-cues/cytoscape-visual-cues";
import cise from "cytoscape-cise";
import cytoscape from "cytoscape";
import timebar from "../../lib/timebar/cytoscape-timebar";
import * as $ from "jquery";
import { GlobalVariableService } from "./global-variable.service";
import {
  MAX_HIGHLIGHT_CNT,
  expandCollapseCuePosition,
  EXPAND_COLLAPSE_CUE_SIZE,
  getCyStyleFromColorAndWid,
} from "./constants";
import panzoom from "cytoscape-panzoom";

// service for cytoscape.js extensions
@Injectable({
  providedIn: "root",
})
export class CyExtService {
  cyNavi: any;

  constructor(private _g: GlobalVariableService) {}

  registerExtensions() {
    timebar(cytoscape);
    navigator(cytoscape);
    viewUtilities(cytoscape);
    expandCollapse(cytoscape);
    layoutUtilities(cytoscape);
    cytoscapeVisualCues(cytoscape);
    cytoscape.use(fcose);
    cytoscape.use(cise);
    cytoscape.use(popper);
    panzoom(cytoscape);
  }

  bindExtensions() {
    this.bindNavigatorExtension();
    this.bindLayoutUtilitiesExtension();
    this.bindPanZoomExtension();
    this.bindExpandCollapseExtension();
  }

  private bindLayoutUtilitiesExtension() {
    this._g.layoutUtils = this._g.cy.layoutUtilities({
      desiredAspectRatio: this._g.cy.width() / this._g.cy.height(),
    });
  }

  bindNavigatorExtension() {
    if (this.cyNavi) {
      return;
    }
    const cyNaviClass = "cytoscape-navigator-wrapper";
    const div = document.createElement("div");
    div.className = cyNaviClass;
    document.getElementById("cy").append(div);

    this.setNavigatorPosition();
    let defaults = {
      container: `.${cyNaviClass}`, // can be a HTML or jQuery
      // element or jQuery selector

      viewLiveFramerate: 0, // set false to update graph pan only on drag end; set 0 to do it
      // instantly; set a number (frames per second) to update not more
      // than N times per second

      thumbnailEventFramerate: 30, // max thumbnail's updates per second triggered by graph updates

      thumbnailLiveFramerate: false, // max thumbnail's updates per second. Set false to disable

      dblClickDelay: 200, // milliseconds

      removeCustomContainer: true, // destroy the container specified by user on plugin destroy

      rerenderDelay: 100, // ms to throttle rerender updates to the panzoom for
      // performance
    };

    this.cyNavi = this._g.cy.navigator(defaults); // get navigator instance, nav
    this._g.cyNaviPositionSetter = this.setNavigatorPosition.bind(this);
    window.removeEventListener("resize", this._g.cyNaviPositionSetter);
    window.removeEventListener("scroll", this._g.cyNaviPositionSetter);

    window.addEventListener("resize", this._g.cyNaviPositionSetter);
    window.addEventListener("scroll", this._g.cyNaviPositionSetter);
    // to render navigator, fire zoom event
    this._g.cy.zoom(this._g.cy.zoom() + 0.00001);
    // to prevent expandCollapse extension's blocking
    (
      document.getElementsByClassName(cyNaviClass)[0] as HTMLElement
    ).style.zIndex = "1000";
  }

  unbindNavigatorExtension() {
    window.removeEventListener("resize", this._g.cyNaviPositionSetter);
    window.removeEventListener("scroll", this._g.cyNaviPositionSetter);
    if (!this.cyNavi) {
      return;
    }
    this.cyNavi.destroy();
    this.cyNavi._removeCyListeners();
    this.cyNavi = null;
  }

  setNavigatorPosition() {
    if (!this._g.userPrefs.isShowOverviewWindow.getValue()) {
      return;
    }
    const navSelector = ".cytoscape-navigator-wrapper";
    const containerSelector = "#cy";

    const topCy = $(containerSelector).offset().top - window.scrollY;
    const leftCy = $(containerSelector).offset().left;
    const heightCy = $(containerSelector).outerHeight();
    const widthCy = $(containerSelector).outerWidth();
    const heightNavigator = $(navSelector).outerHeight();
    const widthNavigator = $(navSelector).outerWidth();
    $(navSelector).css("top", heightCy + topCy - heightNavigator);
    $(navSelector).css("left", widthCy + leftCy - widthNavigator);
  }

  bindViewUtilitiesExtension() {
    let options = {
      highlightStyles: this.getHighlightStyles(),
      setVisibilityOnHide: false, // whether to set visibility on hide/show
      setDisplayOnHide: true, // whether to set display on hide/show
      zoomAnimationDuration: 500, //default duration for zoom animation speed
      neighbor: function (node) {
        // return desired neighbors of tapheld node
        return false;
      },
      neighborSelectTime: 500, //ms, time to taphold to select desired neighbors,
      colorCount: MAX_HIGHLIGHT_CNT,
      htmlElem4marqueeZoom: "#cy",
      marqueeZoomCursor: window.location.href + "assets/img/zoom-cursor.svg",
    };
    this._g.viewUtils = this._g.cy.viewUtilities(options);
    this._g.updateSelectionCyStyle();
  }

  private bindPanZoomExtension() {
    // the default values of each option are outlined below:
    const defaults = {
      zoomFactor: 0.05, // zoom factor per zoom tick
      zoomDelay: 45, // how many ms between zoom ticks
      minZoom: 0.1, // min zoom level
      maxZoom: 10, // max zoom level
      fitPadding: 50, // padding when fitting
      panSpeed: 10, // how many ms in between pan ticks
      panDistance: 10, // max pan distance per tick
      panDragAreaSize: 75, // the length of the pan drag box in which the
      // vector for panning is calculated (bigger = finer
      // control of pan speed and direction)
      panMinPercentSpeed: 0.25, // the slowest speed we can pan by (as a percent of panSpeed)
      panInactiveArea: 8, // radius of inactive area in pan drag box
      panIndicatorMinOpacity: 0.5, // min opacity of pan indicator (the
      // draggable nib); scales from this to 1.0
      zoomOnly: false, // a minimal version of the ui only with zooming (useful
      // on systems with bad mousewheel resolution)
      fitSelector: undefined, // selector of elements to fit
      animateOnFit: function () {
        // whether to animate on fit
        return true;
      },
      fitAnimationDuration: 1000, // duration of animation on fit

      // icon class names
      sliderHandleIcon: "fa fa-minus",
      zoomInIcon: "fa fa-plus",
      zoomOutIcon: "fa fa-minus",
      resetIcon: "fa fa-expand",
    };

    // add the panzoom control
    this._g.cy.panzoom(defaults);
  }

  private bindExpandCollapseExtension() {
    this._g.expandCollapseApi = this._g.cy.expandCollapse({
      layoutBy: null, // to rearrange after expand/collapse. It's just layout options or whole layout function. Choose your side!
      // recommended usage: use cose-bilkent layout with randomize: false to preserve mental map upon expand/collapse
      fisheye: true, // whether to perform fisheye view after expand/collapse you can specify a function too
      animate: true, // whether to animate on drawing changes you can specify a function too
      ready: function () {}, // callback when expand/collapse initialized
      undoable: false, // and if undoRedoExtension exists,
      randomize: false,

      cueEnabled: true, // Whether cues are enabled
      expandCollapseCuePosition: expandCollapseCuePosition,
      expandCollapseCueSize: EXPAND_COLLAPSE_CUE_SIZE, // size of expand-collapse cue
      expandCollapseCueLineSize: 8, // size of lines used for drawing plus-minus icons
      expandCueImage: undefined, // image of expand icon if undefined draw regular expand cue
      collapseCueImage: undefined, // image of collapse icon if undefined draw regular collapse cue
      expandCollapseCueSensitivity: 1, // sensitivity of expand-collapse cues
      allowNestedEdgeCollapse: false,
    });
  }

  private getHighlightStyles(): any[] {
    let r = [];

    for (let i = 0; i < this._g.userPrefs.highlightStyles.length; i++) {
      let style = this._g.userPrefs.highlightStyles[i];
      let w, c;
      try {
        c = style.color.getValue();
        w = style.wid.getValue();
      } catch (err) {
        c = "#6c757d";
        w = 3;
      }

      r.push(getCyStyleFromColorAndWid(c, w));
    }
    return r;
  }
}
