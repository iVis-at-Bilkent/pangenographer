import { formatNumber } from "@angular/common";
import { Injectable } from "@angular/core";
import {
  BADGE_DEFAULT_NODE_SIZE,
  BADGE_POPPER_UPDATE_DELAY,
  BADGE_ZOOM_THRESHOLD,
  COLLAPSED_EDGE_CLASS,
  debounce,
  debounce2,
  mapColor,
} from "./constants";
import { GlobalVariableService } from "./global-variable.service";
import { SequenceDataService } from "./sequence-data.service";

interface PoppedData {
  popper: HTMLDivElement;
  element: any;
  fn: Function;
  fn2: Function;
}
@Injectable({
  providedIn: "root",
})
export class ExternalToolService {
  poppedData: PoppedData[] = [];
  isMapNodeSizes: boolean;
  isMapBadgeSizes: boolean;
  currNodeSize: number;
  maxPropValue: number;
  badgeColor: string;

  constructor(
    private _g: GlobalVariableService,
    private _sequenceDataService: SequenceDataService
  ) {}

  addExternalTools(
    showUpDownstream: (element: any, length: number, up: boolean) => void,
    nodes: any = undefined,
    edges: any = undefined
  ) {
    this.addTooltips(nodes, edges);
    this.addCues(showUpDownstream, nodes);
  }

  removeExternalTools(nodes: any = undefined) {
    this.removeCues(nodes);
  }

  private removeCues(nodes: any = undefined) {
    if (nodes) {
      nodes.forEach((node: any) => {
        this._g.cy.removeListener("pan", this._g.cueUpdaters[`${node.id()}`]);
        this._g.cy.removeListener("zoom", this._g.cueUpdaters[`${node.id()}`]);
        this._g.cy.removeListener(
          "resize",
          this._g.cueUpdaters[`${node.id()}`]
        );
        delete this._g.cueUpdaters[`${node.id()}`];
        node.removeCue();
      });
    } else {
      this._g.cy.nodes().forEach((node: any) => {
        this._g.cy.removeListener("pan", this._g.cueUpdaters[`${node.id()}`]);
        this._g.cy.removeListener("zoom", this._g.cueUpdaters[`${node.id()}`]);
        this._g.cy.removeListener(
          "resize",
          this._g.cueUpdaters[`${node.id()}`]
        );
        delete this._g.cueUpdaters[`${node.id()}`];
        node.removeCue();
      });
    }
  }

  private addCues(
    showUpDownstream: (element: any, length: number, up: boolean) => void,
    nodes: any = undefined
  ) {
    if (!nodes) {
      nodes = this._g.cy.nodes();
    }

    let marginY = 6;
    let marginX = 9;
    let marginXTwo = 6;
    let nameSizeModifier = 0.5;
    let width = 12;

    nodes.forEach((node: any) => {
      let nameSize =
        -this.textWidthCyElement(
          node.data("segmentName"),
          node.pstyle("font-size").strValue,
          node.pstyle("font-family").strValue,
          node.pstyle("font-weight").strValue,
          node.pstyle("font-style").strValue
        ) * nameSizeModifier;

      const contentUpstream1 = document.createElement("img");
      contentUpstream1.src = "assets/img/cue-left.svg";
      contentUpstream1.width = width;
      node.addCue(
        this.addCuePrep(
          node.id(),
          "1",
          "top-left",
          marginX,
          marginXTwo,
          nameSize,
          marginY,
          showUpDownstream,
          1,
          true,
          contentUpstream1,
          "Show Previous"
        )
      );

      const contentUpstreamLevel = document.createElement("img");
      contentUpstreamLevel.src = "assets/img/cue-left-double.svg";
      contentUpstreamLevel.width = width;
      node.addCue(
        this.addCuePrep(
          node.id(),
          "level",
          "top-left",
          marginX,
          0,
          nameSize,
          marginY,
          showUpDownstream,
          this._g.userPreferences.pangenomegrapher.lengthOfUpDownstream.getValue(),
          true,
          contentUpstreamLevel,
          "Show Upstream"
        )
      );

      const contentDownstream1 = document.createElement("img");
      contentDownstream1.src = "assets/img/cue-right.svg";
      contentDownstream1.width = width;
      node.addCue(
        this.addCuePrep(
          node.id(),
          "1",
          "top-right",
          marginX,
          marginXTwo,
          nameSize,
          marginY,
          showUpDownstream,
          1,
          false,
          contentDownstream1,
          "Show Next"
        )
      );

      const contentDownstreamLevel = document.createElement("img");
      contentDownstreamLevel.src = "assets/img/cue-right-double.svg";
      contentDownstreamLevel.width = width;
      node.addCue(
        this.addCuePrep(
          node.id(),
          "level",
          "top-right",
          marginX,
          0,
          nameSize,
          marginY,
          showUpDownstream,
          this._g.userPreferences.pangenomegrapher.lengthOfUpDownstream.getValue(),
          false,
          contentDownstreamLevel,
          "Show Downstream"
        )
      );

      let update = () => {
        this.updateCue(node, nameSize, marginX, marginY, marginXTwo);
      };

      this._g.cueUpdaters[`${node.id()}`] = update;

      node.on("position", update);
      this._g.cy.on("pan zoom resize", update);
    });
  }

  private addCuePrep(
    id: string,
    type: string,
    position: string,
    marginX: number,
    marginXTwo: number,
    nameSize: number,
    marginY: number,
    showUpDownstream: (element: any, length: number, up: boolean) => void,
    showUpDownstreamSize: number,
    isUp: boolean,
    htmlElement: any,
    tooltip: string
  ) {
    return {
      id: `node-cue-${id}-${isUp ? "up" : "down"}-stream-${type}`,
      show: "select",
      position: position,
      marginX: this._g.cy.zoom() * (marginX + marginXTwo + nameSize),
      marginY: this._g.cy.zoom() * marginY,
      onCueClicked: (element: any) => {
        showUpDownstream(element, showUpDownstreamSize, isUp);
      },
      htmlElem: htmlElement,
      isFixedSize: false,
      zIndex: 999,
      cursor: "pointer",
      tooltip: tooltip,
    };
  }

  private updateCue(
    node: any,
    nameSize: number,
    marginX: number,
    marginY: number,
    marginXTwo: number
  ) {
    node.updateCue(
      this.updateCuePrep(
        node.id(),
        marginX,
        marginY,
        nameSize,
        "1",
        "up",
        1,
        marginXTwo
      )
    );
    node.updateCue(
      this.updateCuePrep(
        node.id(),
        marginX,
        marginY,
        nameSize,
        "level",
        "up",
        1
      )
    );
    node.updateCue(
      this.updateCuePrep(
        node.id(),
        marginX,
        marginY,
        nameSize,
        "1",
        "down",
        -1,
        marginXTwo
      )
    );
    node.updateCue(
      this.updateCuePrep(
        node.id(),
        marginX,
        marginY,
        nameSize,
        "level",
        "down",
        -1
      )
    );
  }

  private updateCuePrep(
    id: string,
    marginX: number,
    marginY: number,
    nameSize: number,
    type: string,
    direction: string,
    marginXNeg: number,
    marginXTwo: number = 0
  ) {
    return {
      id: `node-cue-${id}-${direction}-stream-${type}`,
      marginY: this._g.cy.zoom() * marginY,
      marginX:
        this._g.cy.zoom() * (marginX + marginXTwo + nameSize) * marginXNeg,
    };
  }

  addTooltips(
    nodes: any = undefined,
    edges: any = undefined,
    isNode: boolean = true,
    isEdge: boolean = true
  ) {
    let widthOffset = 11;
    let fontSize = "15";
    let fontWeight = "700";
    let fontFamily = "Inconsolata, monospace";
    let fontStyle = "normal";

    if (isNode) {
      if (!nodes) {
        nodes = this._g.cy.nodes();
      }

      nodes.unbind("mouseover");
      nodes.forEach((node: any) => {
        node.bind("mouseover", (event: any) => {
          let popper = event.target.popper({
            content: () => {
              let contentOuter = document.createElement("div");
              if (!node.id()) {
                return contentOuter;
              }
              contentOuter.classList.add("node-tooltip-outer");
              contentOuter.id = `node-tooltip-${node.id()}-outer`;
              let content = document.createElement("div");
              content.classList.add("node-tooltip");
              content.id = `node-tooltip-${node.id()}`;
              content.innerHTML = this.tooltipText(node).text;
              content.style.fontSize = fontSize + "px";
              content.style.fontWeight = fontWeight;
              content.style.fontFamily = fontFamily;
              content.style.fontStyle = fontStyle;
              content.style.maxWidth = `${
                this.textWidthCyElement(
                  content.innerHTML.split("\n")[0],
                  fontSize,
                  fontFamily,
                  fontWeight,
                  fontStyle
                ) + widthOffset
              }px`;
              contentOuter.appendChild(content);
              document.body.appendChild(contentOuter);

              return contentOuter;
            },
          });
          event.target.popperRefObj = popper;
          let update = () => {
            popper.update();
          };

          node.on("position", update);
          this._g.cy.on("pan zoom resize", update);
        });
      });

      nodes.unbind("mouseout");
      nodes.bind("mouseout", (event: any) => {
        if (event.target.popper) {
          event.target.popperRefObj.state.elements.popper.remove();
          event.target.popperRefObj.destroy();
        }
      });
    }

    if (isEdge) {
      if (!edges) {
        edges = this._g.cy.edges();
      }

      edges.unbind("mouseover");
      edges.forEach((edge: any) => {
        if (!edge.hasClass(COLLAPSED_EDGE_CLASS)) {
          edge.bind("mouseover", (event: any) => {
            let popper = event.target.popper({
              content: () => {
                let contentOuter = document.createElement("div");
                contentOuter.classList.add("edge-tooltip-outer");
                contentOuter.id = `edge-tooltip-${edge
                  .source()
                  .data("segmentName")}-${edge
                  .source()
                  .data("segmentName")}-outer`;

                let content = document.createElement("div");
                content.classList.add("edge-tooltip");
                content.id = `edge-tooltip-${edge
                  .source()
                  .data("segmentName")}-${edge.source().data("segmentName")}`;

                let text = this.tooltipText(edge);
                content.style.fontSize = fontSize + "px";
                content.style.fontWeight = fontWeight;
                content.style.fontFamily = fontFamily;
                content.style.fontStyle = fontStyle;
                content.style.maxWidth = `${
                  this.textWidthCyElement(
                    text.text.split("\n")[0],
                    fontSize,
                    fontFamily,
                    fontWeight,
                    fontStyle
                  ) + widthOffset
                }px`;

                let firstSequence = document.createElement("span");
                firstSequence.classList.add("edge-tooltip-inner-part");
                firstSequence.innerHTML = text.text.substring(
                  0,
                  this.edgeTooltipInnerTextSize(text.lengths.firstSequence)
                );

                content.appendChild(firstSequence);

                if (edge.data("overlap") && !edge.data("pos")) {
                  let overlapIdentifier = edge
                    .data("overlap")
                    .split(/[0-9]+/)
                    .slice(1);
                  let overlapNumerics = text.lengths.overlapNumerics;
                  let currentIndex = 0;

                  let classLists = (overlapIdentifier: string) => {
                    if (overlapIdentifier === "I") {
                      return "edge-CIGAR-I";
                    } else if (overlapIdentifier === "N") {
                      return "edge-CIGAR-N";
                    } else if (overlapIdentifier === "D") {
                      return "edge-CIGAR-D";
                    } else if (
                      overlapIdentifier === "S" ||
                      overlapIdentifier === "H"
                    ) {
                      return "edge-CIGAR-S-H";
                    } else {
                      return "edge-CIGAR-M-Eq-X";
                    }
                  };

                  overlapIdentifier.forEach(
                    (overlapId: string, index: number) => {
                      let secondSequence = document.createElement("span");
                      secondSequence.classList.add(classLists(overlapId));
                      secondSequence.innerHTML = text.text.substring(
                        this.edgeTooltipInnerTextSize(
                          text.lengths.firstSequence + currentIndex
                        ),
                        Math.min(
                          this.edgeTooltipInnerTextSize(
                            text.lengths.firstSequence +
                              currentIndex +
                              overlapNumerics[index]
                          ),
                          this.edgeTooltipInnerTextSize(
                            text.lengths.secondSequence +
                              text.lengths.firstSequence
                          )
                        )
                      );

                      currentIndex += overlapNumerics[index];

                      content.appendChild(secondSequence);
                    }
                  );
                } else {
                  let secondSequence = document.createElement("span");
                  secondSequence.classList.add("edge-CIGAR-M-Eq-X");
                  secondSequence.innerHTML = text.text.substring(
                    this.edgeTooltipInnerTextSize(text.lengths.firstSequence),
                    this.edgeTooltipInnerTextSize(
                      text.lengths.firstSequence + text.lengths.secondSequence
                    )
                  );

                  content.appendChild(secondSequence);
                }

                let thirdSequence = document.createElement("span");
                thirdSequence.innerHTML = text.text.substring(
                  this.edgeTooltipInnerTextSize(
                    text.lengths.firstSequence + text.lengths.secondSequence
                  )
                );
                thirdSequence.classList.add("edge-tooltip-inner-part");

                content.appendChild(thirdSequence);
                contentOuter.appendChild(content);
                document.body.appendChild(contentOuter);
                return contentOuter;
              },
            });
            event.target.popperRefObj = popper;
            let update = () => {
              popper.update();
            };

            edge.on("position", update);
            this._g.cy.on("pan zoom resize", update);
          });
        }
      });

      edges.unbind("mouseout");
      edges.bind("mouseout", (event: any) => {
        if (event.target.popper && event.target.popperRefObj) {
          event.target.popperRefObj.state.elements.popper.remove();
          event.target.popperRefObj.destroy();
        }
      });
    }
  }

  private edgeTooltipInnerTextSize(size: number): number {
    return size > 245 ? 245 : size + Math.floor(size / 41);
  }

  private textWidthCyElement(
    text: string,
    fontSize: string,
    fontFamily: string,
    fontWeight: string,
    fontStyle: string
  ): number {
    let context = document.createElement("canvas").getContext("2d");
    let fsize = fontSize + "px";
    context.font =
      fontStyle + " " + fontWeight + " " + fsize + " " + fontFamily;
    return context.measureText(text).width;
  }

  private tooltipText(element: any): {
    text: string;
    lengths: {
      firstSequence: number;
      secondSequence: number;
      thirdSequence: number;
      overlapNumerics: number[];
    };
  } {
    let textData = "";
    let text = "";
    let firstSequence = "";
    let secondSequence = "";
    let thirdSequence = "";
    let overlapNumerics = [];

    if (element.data("sourceOrientation")) {
      let firstThreshold = 20;
      let secondThreshold = 200;
      let thirdThreshold = 20;
      let toAdd = 0;
      let combinedSequence =
        this._sequenceDataService.prepareCombinedSequence(element);
      firstSequence = combinedSequence.firstSequence;
      secondSequence = combinedSequence.secondSequence;
      thirdSequence = combinedSequence.thirdSequence;
      overlapNumerics = combinedSequence.overlapNumerics;

      if (firstSequence.length <= firstThreshold) {
        toAdd += firstThreshold - firstSequence.length;
        firstThreshold = firstSequence.length;
      }
      if (secondSequence.length <= secondThreshold) {
        toAdd += secondThreshold - secondSequence.length;
        secondThreshold = secondSequence.length;
      }
      if (thirdSequence.length <= thirdThreshold) {
        toAdd += thirdThreshold - thirdSequence.length;
        thirdThreshold = thirdSequence.length;
      }

      if (secondSequence.length > secondThreshold) {
        if (toAdd > secondSequence.length - secondThreshold) {
          toAdd -= secondSequence.length - secondThreshold;
          secondThreshold += secondSequence.length - secondThreshold;
        } else {
          secondThreshold += toAdd;
          toAdd = 0;
        }
      }
      if (firstSequence.length > firstThreshold) {
        if (toAdd > firstSequence.length - firstThreshold) {
          toAdd -= firstSequence.length - firstThreshold;
          firstThreshold += firstSequence.length - firstThreshold;
        } else {
          firstThreshold += toAdd;
          toAdd = 0;
        }
      }
      if (thirdSequence.length > thirdThreshold) {
        if (toAdd > thirdSequence.length - thirdThreshold) {
          toAdd -= thirdSequence.length - thirdThreshold;
          thirdThreshold += thirdSequence.length - thirdThreshold;
        } else {
          thirdThreshold += toAdd;
          toAdd = 0;
        }
      }

      if (firstSequence.length > firstThreshold) {
        firstSequence =
          ".." +
          firstSequence.substring(firstSequence.length - firstThreshold + 2);
      }
      if (secondSequence.length > secondThreshold) {
        secondSequence =
          secondSequence.substring(0, Math.ceil(secondThreshold / 2) - 1) +
          ".." +
          secondSequence.substring(
            secondSequence.length - Math.floor(secondThreshold / 2) + 1
          );
      }
      if (thirdSequence.length > thirdThreshold) {
        thirdSequence = thirdSequence.substring(0, thirdThreshold - 2) + "..";
      }

      textData = firstSequence + secondSequence + thirdSequence;
    } else {
      textData = element.data("segmentData");
    }

    let startIndex: number;

    for (startIndex = 0; startIndex < 200; startIndex += 40) {
      if (startIndex >= textData.length) {
        break;
      }
      text +=
        textData.substring(
          startIndex,
          startIndex +
            (textData.length < 40 + startIndex
              ? textData.length - startIndex
              : 40)
        ) + "\n";
    }

    if (textData.length > 240) {
      text += textData.substring(startIndex, startIndex + 38) + "..";
    } else if (textData.length >= startIndex) {
      text += textData.substring(
        startIndex,
        startIndex +
          (textData.length < 40 + startIndex
            ? textData.length - startIndex
            : 40)
      );
    }

    let lengths = {
      firstSequence: firstSequence.length,
      secondSequence: secondSequence.length,
      thirdSequence: thirdSequence.length,
      overlapNumerics: overlapNumerics,
    };
    return { text, lengths };
  }

  private badgeGetHtml(badges: number[]): string {
    let s = "";
    for (let i = 0; i < badges.length; i++) {
      s += `<span class="badge badge-pill badge-primary strokeme">${formatNumber(
        badges[i],
        "en",
        "1.0-2"
      )}</span>`;
    }
    return s;
  }

  setBadgePopperValues(
    isMapNodeSizes: boolean,
    isMapBadgeSizes: boolean,
    currNodeSize: number,
    maxPropValue: number,
    badgeColor: string
  ) {
    this.isMapNodeSizes = isMapNodeSizes;
    this.isMapBadgeSizes = isMapBadgeSizes;
    this.currNodeSize = currNodeSize;
    this.maxPropValue = maxPropValue;
    this.badgeColor = badgeColor;
  }

  destroyCurrentBadgePoppers() {
    while (this.poppedData.length > 0) {
      this.destroyBadgePopper("", 0);
    }
  }

  destroyBadgePopper(id: string, i: number) {
    if (i < 0) {
      i = this.poppedData.findIndex((x: any) => x.element.id() == id);
      if (i < 0) {
        return;
      }
    }
    this.poppedData[i].popper.remove();
    // unbind previously bound functions
    if (this.poppedData[i].fn) {
      this.poppedData[i].element.off("position", this.poppedData[i].fn);
      this.poppedData[i].element.off("style", this.poppedData[i].fn2);
      this._g.cy.off("pan zoom resize", this.poppedData[i].fn);
    }
    this.poppedData[i].element.removeClass("badgeDisplay");
    this.poppedData[i].element.data("__badgeProp", undefined);
    this.poppedData.splice(i, 1);
  }

  generateBadge4Element(e: any, badges: number[]) {
    const div = document.createElement("div");
    div.innerHTML = this.badgeGetHtml(badges);
    div.style.position = "absolute";
    div.style.top = "0px";
    div.style.left = "0px";
    document.getElementById("cy").appendChild(div);

    if (this.isMapNodeSizes || this.isMapBadgeSizes) {
      let sum = 0;
      for (let i = 0; i < badges.length; i++) {
        sum += badges[i];
      }
      e.data("__badgeProp", sum / badges.length);
    }
    if (this.isMapNodeSizes) {
      e.removeClass("badgeDisplay");
      e.addClass("badgeDisplay");
    }

    const positionHandlerFn = debounce2(
      () => {
        this.setBadgeCoordinates(e, div);
        this.setBadgeCoordinatesOfChildren(e);
      },
      BADGE_POPPER_UPDATE_DELAY,
      () => {
        this.showHideBadge(false, div);
      }
    ).bind(this);
    const styleHandlerFn = debounce(() => {
      this.setBadgeVisibility(e, div);
    }, BADGE_POPPER_UPDATE_DELAY * 2).bind(this);

    e.on("position", positionHandlerFn);
    e.on("style", styleHandlerFn);
    this._g.cy.on("pan zoom resize", positionHandlerFn);
    this.poppedData.push({
      popper: div,
      element: e,
      fn: positionHandlerFn,
      fn2: styleHandlerFn,
    });
  }

  setBadgeColorsAndCoords() {
    for (let i = 0; i < this.poppedData.length; i++) {
      let c = mapColor(
        this.badgeColor,
        this.maxPropValue,
        this.poppedData[i].element.data("__badgeProp")
      );

      for (let j = 0; j < this.poppedData[i].popper.children.length; j++) {
        (
          this.poppedData[i].popper.children[j] as HTMLSpanElement
        ).style.background = c;
      }
      this.setBadgeCoordinates(
        this.poppedData[i].element,
        this.poppedData[i].popper
      );
    }
  }

  private setBadgeVisibility(e: any, div: HTMLDivElement) {
    if (!e.visible()) {
      div.style.opacity = "0";
    }
  }

  private setBadgeCoordinates(e: any, div: HTMLDivElement) {
    // let the nodes resize first
    setTimeout(() => {
      let ratio = 1;
      if (this.isMapBadgeSizes) {
        let b = this.currNodeSize + 20;
        let a = Math.max(5, this.currNodeSize - 20);
        let x = e.data("__badgeProp");
        ratio = (((b - a) * x) / this.maxPropValue + a) / this.currNodeSize;
      } else {
        ratio = this.currNodeSize / BADGE_DEFAULT_NODE_SIZE;
      }
      ratio = ratio < BADGE_ZOOM_THRESHOLD ? BADGE_ZOOM_THRESHOLD : ratio;

      let z1 = (this._g.cy.zoom() / 2) * ratio;
      const bb = e.renderedBoundingBox({
        includeLabels: false,
        includeOverlays: false,
      });
      const w = div.clientWidth;
      const h = div.clientHeight;
      const deltaW4Scale = ((1 - z1) * w) / 2;
      const deltaH4Scale = ((1 - z1) * h) / 2;
      div.style.transform = `translate(${bb.x2 - deltaW4Scale - w * z1}px, ${
        bb.y1 - deltaH4Scale
      }px) scale(${z1})`;
      this.showHideBadge(e.visible(), div);
    }, 0);
  }

  private showHideBadge(isShow: boolean, div: HTMLDivElement) {
    let z = this._g.cy.zoom();
    if (z <= BADGE_ZOOM_THRESHOLD) {
      isShow = false;
    }
    let css = "0";
    if (isShow) {
      css = "1";
    }
    div.style.opacity = css;
  }

  private setBadgeCoordinatesOfChildren(e: any) {
    const elements = e.children();
    for (let i = 0; i < elements.length; i++) {
      const child = elements[i];
      if (child.isParent()) {
        this.setBadgeCoordinatesOfChildren(child);
      } else {
        const index = this.poppedData.findIndex(
          (x: any) => x.element.id() == child.id()
        );
        if (index > -1) {
          this.setBadgeCoordinates(
            this.poppedData[index].element,
            this.poppedData[index].popper
          );
        }
      }
    }
  }
}
