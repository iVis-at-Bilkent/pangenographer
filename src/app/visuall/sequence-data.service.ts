import { Injectable } from "@angular/core";
@Injectable({
  providedIn: "root",
})
export class SequenceDataService {
  constructor() {}

  reverseComplementSegmentData(segmentData: string): string {
    segmentData = segmentData.split("").reverse().join("");
    let s = "";

    for (let i = 0; i < segmentData.length; i++) {
      if (segmentData[i] === "A") {
        s += "T";
      } else if (segmentData[i] === "T") {
        s += "A";
      } else if (segmentData[i] === "C") {
        s += "G";
      } else {
        s += "C";
      }
    }

    return s;
  }

  prepareCombinedSequence(element: any): {
    firstSequence: string;
    secondSequence: string;
    thirdSequence: string;
    sequenceLength: number;
    overlapNumerics: number[];
  } {
    let firstSequence = ""; // first sequence of combined sequence
    let secondSequence = ""; // second sequence of combined sequence
    let thirdSequence = ""; // third sequence of combined sequence
    let sequenceLength: number;
    let overlapNumerics = [];

    if (element.data("distance")) {
      secondSequence = "..(" + element.data("distance") + ")..";

      firstSequence = element.source().data("segmentData");

      if (element.data("sourceOrientation") === "-") {
        firstSequence = this.reverseComplementSegmentData(firstSequence);
      }

      thirdSequence = element.target().data("segmentData");

      if (element.data("targetOrientation") === "-") {
        thirdSequence = this.reverseComplementSegmentData(thirdSequence);
      }

      if (element.data("distance") === "*") {
        sequenceLength = element.data("distance");
      } else {
        sequenceLength =
          Number(element.data("distance")) +
          firstSequence.length +
          thirdSequence.length;
      }
    } else if (element.data("pos")) {
      let container = element.source().data("segmentData");

      if (element.data("sourceOrientation") === "-") {
        container = this.reverseComplementSegmentData(container);
      }

      firstSequence = container.substring(0, element.data("pos"));

      secondSequence = element.target().data("segmentData");
      if (element.data("targetOrientation") === "-") {
        secondSequence = this.reverseComplementSegmentData(secondSequence);
      }

      thirdSequence = container.substring(
        element.data("pos") + secondSequence.length
      );

      sequenceLength = container.length;
    } else {
      let overlapNumericsData: number[];
      let overlapIdentifiers: string[];
      let overlapLengthSource = 0;
      let overlapLengthTarget = 0;

      firstSequence = element.source().data("segmentData");
      if (element.data("sourceOrientation") === "-") {
        firstSequence = this.reverseComplementSegmentData(firstSequence);
      }
      thirdSequence = element.target().data("segmentData");
      if (element.data("targetOrientation") === "-") {
        thirdSequence = this.reverseComplementSegmentData(thirdSequence);
      }

      secondSequence = "";
      if (element.data("overlap") !== "*") {
        overlapNumericsData = element
          .data("overlap")
          .split(/[MIDNSHPX=]/)
          .map((num: string) => {
            return Number(num);
          });
        overlapNumericsData.pop();
        overlapIdentifiers = element
          .data("overlap")
          .split(/[0-9]+/)
          .slice(1);

        overlapIdentifiers.forEach((overlapIdentifier, index) => {
          if (overlapIdentifier === "I") {
            overlapLengthTarget += overlapNumericsData[index];
          } else if (
            overlapIdentifier === "D" ||
            overlapIdentifier === "N" ||
            overlapIdentifier === "H"
          ) {
            overlapLengthSource += overlapNumericsData[index];
          } else if (
            overlapIdentifier === "M" ||
            overlapIdentifier === "=" ||
            overlapIdentifier === "X" ||
            overlapIdentifier === "S"
          ) {
            overlapLengthSource += overlapNumericsData[index];
            overlapLengthTarget += overlapNumericsData[index];
          } else {
            console.log(
              "Unknown overlap identifier: " +
                overlapIdentifier +
                " in " +
                element.data("overlap") +
                " of " +
                element.id() +
                " in " +
                element.data("source") +
                " to " +
                element.data("target")
            );
            console.log("It may not be displayed correctly.");
          }
        });

        let currentOverlapLengthSource = 0;
        let currentOverlapLengthTarget = 0;

        overlapIdentifiers.forEach((overlapIdentifier, index) => {
          if (overlapIdentifier === "I") {
            secondSequence += thirdSequence.substring(
              currentOverlapLengthTarget,
              currentOverlapLengthTarget + overlapNumericsData[index]
            );

            overlapNumerics.push(overlapNumericsData[index]);
            currentOverlapLengthTarget += overlapNumericsData[index];
          } else if (
            overlapIdentifier === "D" ||
            overlapIdentifier === "N" ||
            overlapIdentifier === "H"
          ) {
            secondSequence += firstSequence.substring(
              firstSequence.length -
                overlapLengthSource +
                currentOverlapLengthSource,
              firstSequence.length -
                overlapLengthSource +
                currentOverlapLengthSource +
                overlapNumericsData[index]
            );

            overlapNumerics.push(overlapNumericsData[index]);
            currentOverlapLengthSource += overlapNumericsData[index];
          } else if (
            overlapIdentifier === "=" ||
            overlapIdentifier === "S" ||
            overlapIdentifier === "M" ||
            overlapIdentifier === "X"
          ) {
            let sourceMatch = firstSequence.substring(
              firstSequence.length -
                overlapLengthSource +
                currentOverlapLengthSource,
              firstSequence.length -
                overlapLengthSource +
                currentOverlapLengthSource +
                overlapNumericsData[index]
            );

            let targetMatch = thirdSequence.substring(
              currentOverlapLengthTarget,
              currentOverlapLengthTarget + overlapNumericsData[index]
            );

            let matches = true;
            if (
              overlapIdentifier === "X" ||
              overlapIdentifier === "S" ||
              (overlapIdentifier === "M" && targetMatch !== sourceMatch)
            ) {
              matches = false;
            }

            if (matches) {
              secondSequence += sourceMatch;
              overlapNumerics.push(sourceMatch.length);
            } else {
              secondSequence += "[" + sourceMatch + "|" + targetMatch + "]";
              overlapNumerics.push(3 + sourceMatch.length + targetMatch.length);
            }

            currentOverlapLengthTarget += overlapNumericsData[index];
            currentOverlapLengthSource += overlapNumericsData[index];
          } else {
            console.log(
              "Unknown overlap identifier: " +
                overlapIdentifier +
                " in " +
                element.data("overlap") +
                " of " +
                element.id() +
                " in " +
                element.data("source") +
                " to " +
                element.data("target")
            );
            console.log("It may not be displayed correctly.");
          }
        });
      }

      firstSequence = firstSequence.substring(
        0,
        firstSequence.length -
          (element.data("overlap") === "*" ? 0 : overlapLengthSource)
      );

      thirdSequence = thirdSequence.substring(overlapLengthTarget);

      sequenceLength =
        firstSequence.length + secondSequence.length + thirdSequence.length;
    }

    return {
      firstSequence,
      secondSequence,
      thirdSequence,
      sequenceLength,
      overlapNumerics,
    };
  }
}
