import { formatNumber } from "@angular/common";
import { Injectable } from "@angular/core";
import {
  BADGE_POPPER_UPDATE_DELAY,
  BADGE_ZOOM_THRESHOLD,
  COLLAPSED_EDGE_CLASS,
  COMBINED_SEQUENCE_THRESHOLDS,
  CUE_CONFIG,
  debounce,
  debounce2,
  DEFAULT_NODE_WIDTH,
  mapColor,
  TOOLTIP_CONFIG,
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
  currentNodeSize: number;
  ratioCurrentNodeSize2Default: number;
  maxPropertyValue: number;
  badgeColor: string;

  constructor(
    private _g: GlobalVariableService,
    private _sequenceDataService: SequenceDataService
  ) {}

  // Removes all or provided nodes' cues that show upstream and downstream elements
  removeCues(nodes: any = this._g.cy.nodes()) {
    this._g.cy.startBatch();

    // Remove cues from the provided nodes
    nodes.forEach((node: any) => {
      this._g.cy.removeListener(
        "pan zoom resize",
        this._g.cueUpdaters[`${node.id()}`]
      );
      delete this._g.cueUpdaters[`${node.id()}`];
      node.removeCue();
    });

    this._g.cy.endBatch();
  }

  // Add cues to the graph
  // Cues show arrows on the top left and top right of the element to show upstream and downstream elements
  addCues(
    showUpDownstream: (nodeId: any, length: number, up: boolean) => void,
    nodes: any = this._g.cy.nodes()
  ) {
    // If the cues are not set to be shown, return
    if (!this._g.userPreferences.isShowUpDownstreamCues.getValue()) {
      return;
    }

    this._g.cy.startBatch();

    let marginY = CUE_CONFIG.marginY;
    let marginX = CUE_CONFIG.marginX;
    let marginXTwo = CUE_CONFIG.marginXTwo;
    let width = CUE_CONFIG.width;

    nodes.forEach((node: any) => {
      const contentUpstream1 = document.createElement("img");
      contentUpstream1.src = "assets/img/cue-left.svg";
      contentUpstream1.width = width;
      node.addCue(
        this.addCuePreparation(
          node.id(),
          "1",
          "top-left",
          marginX,
          marginXTwo,
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
        this.addCuePreparation(
          node.id(),
          "level",
          "top-left",
          marginX,
          0,
          marginY,
          showUpDownstream,
          this._g.userPreferences.lengthOfUpDownstream.getValue(),
          true,
          contentUpstreamLevel,
          "Show Upstream"
        )
      );

      const contentDownstream1 = document.createElement("img");
      contentDownstream1.src = "assets/img/cue-right.svg";
      contentDownstream1.width = width;
      node.addCue(
        this.addCuePreparation(
          node.id(),
          "1",
          "top-right",
          marginX,
          marginXTwo,
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
        this.addCuePreparation(
          node.id(),
          "level",
          "top-right",
          marginX,
          0,
          marginY,
          showUpDownstream,
          this._g.userPreferences.lengthOfUpDownstream.getValue(),
          false,
          contentDownstreamLevel,
          "Show Downstream"
        )
      );

      let update = () => {
        this.updateCue(node, marginX, marginY, marginXTwo);
      };

      this._g.cueUpdaters[`${node.id()}`] = update;

      node.on("position", update);
      this._g.cy.on("pan zoom resize", update);
    });

    this._g.cy.endBatch();

    // Update the cues to make sure they are shown when the graph is loaded
    this._g.refreshCuesBadges();
  }

  private addCuePreparation(
    id: string,
    type: string,
    position: string,
    marginX: number,
    marginXTwo: number,
    marginY: number,
    showUpDownstream: (nodeId: any, length: number, up: boolean) => void,
    showUpDownstreamSize: number,
    isUp: boolean,
    htmlElement: any,
    tooltip: string
  ) {
    return {
      id: `node-cue-${id}-${isUp ? "up" : "down"}-stream-${type}`,
      show: "select",
      position: position,
      marginX: this._g.cy.zoom() * (marginX + marginXTwo),
      marginY: this._g.cy.zoom() * marginY,
      onCueClicked: (element: any) => {
        showUpDownstream(
          element.id().substring(1), // remove the first character which is 'n' or 'e' to get the id stored in the database
          showUpDownstreamSize,
          isUp
        );
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
    marginX: number,
    marginY: number,
    marginXTwo: number
  ) {
    node.updateCue(
      this.updateCuePrep(node, marginX, marginY, "1", "up", 1, marginXTwo)
    );

    node.updateCue(
      this.updateCuePrep(node, marginX, marginY, "level", "up", 1)
    );

    node.updateCue(
      this.updateCuePrep(node, marginX, marginY, "1", "down", -1, marginXTwo)
    );

    node.updateCue(
      this.updateCuePrep(node, marginX, marginY, "level", "down", -1)
    );
  }

  // Prepare the new margins for the cues for the given node
  private updateCuePrep(
    node: any,
    marginX: number,
    marginY: number,
    type: string,
    direction: string,
    marginXNeg: number,
    marginXTwo: number = 0
  ): {
    id: string;
    marginY: number;
    marginX: number;
  } {
    // Calculate the new margins again if the node size is changed from the default size
    // Node size is changed when the BLAST result badges or graph theoretic property result badges are shown
    // This is done to keep the cues in the same position relative to the node
    // Get the width and height of the node and calculate the new margins
    let width = node.style("width");
    width = Number(node.style("width").substring(0, width.length - 2));
    let height = node.style("height");
    height = Number(node.style("height").substring(0, height.length - 2));

    // If the width and height are different than the default node width
    // adjust the margins so that the cues are shown below the node
    if (width !== DEFAULT_NODE_WIDTH && height !== DEFAULT_NODE_WIDTH) {
      marginY *= (height / DEFAULT_NODE_WIDTH) * 2;
      marginX *= width / DEFAULT_NODE_WIDTH;
    }

    // Adjust the margins according to the zoom level of the graph and the direction of the cue
    marginY = this._g.cy.zoom() * marginY;
    marginX = this._g.cy.zoom() * (marginX + marginXTwo) * marginXNeg;

    return {
      id: `node-cue-${node.id()}-${direction}-stream-${type}`,
      marginY: marginY,
      marginX: marginX,
    };
  }

  // Add tooltips to the graph
  // Tooltips show some part of the element's data when hovered over
  addTooltips(
    nodes: any = this._g.cy.nodes(),
    edges: any = this._g.cy.edges(),
    isNode: boolean = true,
    isEdge: boolean = true
  ) {
    this._g.cy.startBatch();

    // Set tootip constants for the nodes and edges in the graph
    // These constants are used to set the tooltip's font size, weight, family, style, and width
    let widthOffset = TOOLTIP_CONFIG.widthOffset;
    let fontSize = TOOLTIP_CONFIG.fontSize;
    let fontWeight = TOOLTIP_CONFIG.fontWeight;
    let fontFamily = TOOLTIP_CONFIG.fontFamily;
    let fontStyle = TOOLTIP_CONFIG.fontStyle;

    if (isNode) {
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

                if (edge.data("overlap") && !edge.data("pos") && text.lengths.secondSequence > 0) {
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

    this._g.cy.endBatch();
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

  // Generates the tooltip text for the given element.
  // Nodes have their segment data as the tooltip text.
  // Edges have their overlap data (distance for jumps) prioritized as the tooltip text.
  private tooltipText(element: any): {
    text: string;
    lengths: {
      firstSequence: number;
      secondSequence: number;
      thirdSequence: number;
      overlapNumerics: number[];
    };
  } {
    let textData = ""; // The text data to be shown in the tooltip
    let text = ""; // final text to be shown in the tooltip
    let firstSequence = ""; // The first sequence of the edge before the overlap
    let secondSequence = ""; // The second sequence of the edge after the overlap
    let thirdSequence = ""; // The third sequence of the edge after the overlap
    let overlapNumerics = []; // The individual overlap numerics of the edge

    // If the element is an edge
    if (element.data("sourceOrientation")) {
      let firstThreshold = COMBINED_SEQUENCE_THRESHOLDS.firstThreshold; // The maximum length of the first sequence to be shown in the tooltip
      let secondThreshold = COMBINED_SEQUENCE_THRESHOLDS.secondThreshold; // The maximum length of the second sequence to be shown in the tooltip
      let thirdThreshold = COMBINED_SEQUENCE_THRESHOLDS.thirdThreshold; // The maximum length of the third sequence to be shown in the tooltip
      let toAdd = 0; // The number of characters to be added to the sequences to reach the thresholds
      let combinedSequence =
        this._sequenceDataService.prepareCombinedSequence(element); // The combined sequence of the edge

      firstSequence = combinedSequence.firstSequence; // The first sequence of the edge before the overlap
      secondSequence = combinedSequence.secondSequence; // The second sequence of the edge after the overlap
      thirdSequence = combinedSequence.thirdSequence; // The third sequence of the edge after the overlap
      overlapNumerics = combinedSequence.overlapNumerics; // The individual overlap numerics of the edge

      // If the sequences are shorter than the thresholds, add the necessary characters to reach the thresholds
      if (firstSequence.length <= firstThreshold) {
        toAdd += firstThreshold - firstSequence.length;
        firstThreshold = firstSequence.length;
      }

      // If the sequences are shorter than the thresholds, add the necessary characters to reach the thresholds
      if (secondSequence.length <= secondThreshold) {
        toAdd += secondThreshold - secondSequence.length;
        secondThreshold = secondSequence.length;
      }

      // If the sequences are shorter than the thresholds, add the necessary characters to reach the thresholds
      if (thirdSequence.length <= thirdThreshold) {
        toAdd += thirdThreshold - thirdSequence.length;
        thirdThreshold = thirdSequence.length;
      }

      // As we prioritize the second sequence (overlap data), add the remaining characters to the second sequence
      // If the second sequence higher than the threshold,
      // check if the remaining characters to be added is higher than the length of the second sequence after the threshold
      if (secondSequence.length > secondThreshold) {
        // Adjust the threshold and the remaining characters to be added
        if (toAdd > secondSequence.length - secondThreshold) {
          toAdd -= secondSequence.length - secondThreshold;
          secondThreshold += secondSequence.length - secondThreshold;
        } else {
          secondThreshold += toAdd;
          toAdd = 0;
        }
      }

      // We secondly prioritize the first sequence,
      // If the first sequence higher than the threshold,
      // check if the remaining characters to be added is higher than the length of the first sequence after the threshold
      // Adjust the threshold and the remaining characters to be added
      if (firstSequence.length > firstThreshold) {
        if (toAdd > firstSequence.length - firstThreshold) {
          toAdd -= firstSequence.length - firstThreshold;
          firstThreshold += firstSequence.length - firstThreshold;
        } else {
          firstThreshold += toAdd;
          toAdd = 0;
        }
      }

      // If the third sequence higher than the threshold,
      // check if the remaining characters to be added is higher than the length of the third sequence after the threshold
      // Adjust the threshold and the remaining characters to be added
      if (thirdSequence.length > thirdThreshold) {
        if (toAdd > thirdSequence.length - thirdThreshold) {
          toAdd -= thirdSequence.length - thirdThreshold;
          thirdThreshold += thirdSequence.length - thirdThreshold;
        } else {
          thirdThreshold += toAdd;
          toAdd = 0;
        }
      }

      // If the first sequence is longer than the threshold, add ellipsis to the beginning
      // then add the last characters of the first sequence to reach the threshold
      if (firstSequence.length > firstThreshold) {
        firstSequence =
          ".." +
          firstSequence.substring(firstSequence.length - firstThreshold + 2);
      }

      // If the second sequence (overlap data) is longer than the threshold, add ellipsis to the middle of the sequence
      // then add the first and last characters of the second sequence to reach the threshold
      if (secondSequence.length > secondThreshold) {
        secondSequence =
          secondSequence.substring(0, Math.ceil(secondThreshold / 2) - 1) +
          ".." +
          secondSequence.substring(
            secondSequence.length - Math.floor(secondThreshold / 2) + 1
          );
      }

      // If the third sequence is longer than the threshold, add ellipsis to the end
      // then add the first characters of the third sequence to reach the threshold
      if (thirdSequence.length > thirdThreshold) {
        thirdSequence = thirdSequence.substring(0, thirdThreshold - 2) + "..";
      }

      // Combine the sequences to create the tooltip text
      textData = firstSequence + secondSequence + thirdSequence;
    }
    // If the element is a node text data is just the segment data
    else {
      textData = element.data("segmentData");
    }

    // Split the text data into lines of 40 characters
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

    // If the text data is longer than 240 characters, add ellipsis to the end
    if (textData.length > 240) {
      text += textData.substring(startIndex, startIndex + 38) + "..";
    }
    // If the text data is shorter than 240 characters, add the last characters
    else if (textData.length >= startIndex) {
      text += textData.substring(
        startIndex,
        startIndex +
          (textData.length < 40 + startIndex
            ? textData.length - startIndex
            : 40)
      );
    }

    // Return the tooltip text and the lengths of the sequences
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
    currentNodeSize: number,
    maxPropertyValue: number,
    badgeColor: string
  ) {
    this.isMapNodeSizes = isMapNodeSizes;
    this.isMapBadgeSizes = isMapBadgeSizes;
    this.currentNodeSize = currentNodeSize;
    this.maxPropertyValue = maxPropertyValue;
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
    this.poppedData[i].element.data("__badgeProperty", undefined);
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
      e.data("__badgeProperty", sum / badges.length);
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
        this.maxPropertyValue,
        this.poppedData[i].element.data("__badgeProperty")
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

  // Set the coordinates of the badge for the given element
  // The badge is shown on the top right of the element
  // The badge is scaled according to the zoom level of the graph
  // TODO: make this function more readable
  private setBadgeCoordinates(e: any, div: HTMLDivElement) {
    // Change the node size according to the maximum property value
    if (this.isMapBadgeSizes) {
      let b = this.currentNodeSize + 20;
      let a = Math.max(5, this.currentNodeSize - 20);
      let x = e.data("__badgeProperty");

      this.ratioCurrentNodeSize2Default =
        (((b - a) * x) / this.maxPropertyValue + a) / this.currentNodeSize;
    } else {
      this.ratioCurrentNodeSize2Default =
        this.currentNodeSize / DEFAULT_NODE_WIDTH;
    }

    this.ratioCurrentNodeSize2Default =
      this.ratioCurrentNodeSize2Default < BADGE_ZOOM_THRESHOLD
        ? BADGE_ZOOM_THRESHOLD
        : this.ratioCurrentNodeSize2Default;

    let z1 = (this._g.cy.zoom() / 2) * this.ratioCurrentNodeSize2Default;

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
