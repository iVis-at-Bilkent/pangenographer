import { Injectable } from "@angular/core";
import { OVERLAP_REGEX } from "./constants";

export interface CombinedSequence {
  firstSequence: string;
  secondSequence: string;
  thirdSequence: string;
  sequenceLength: number;
  overlapNumerics: number[];
}

@Injectable({
  providedIn: "root",
})
export class SequenceDataService {
  constructor() {}

  // This is a function that returns the reverse complement of a segment data.
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

  // This is a function that prints a console message when an unknown overlap identifier is found.
  printConsoleUnknownOverlapIdentifier(
    element: any,
    overlapIdentifier: string
  ) {
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
        element.data("target") +
        "\nIt may not be displayed correctly."
    );
  }

  // This is a function that prepares a combined sequence for a jumps.
  // It takes an element as an argument and returns a CombinedSequence object.
  // The CombinedSequence object has the following properties:
  // - firstSequence which represents the sequence before the jump
  // - secondSequence which represents the sequence of the jump
  // - thirdSequence which represents the sequence after the jump
  // - sequenceLength which represents the length of the combined sequence
  // - overlapNumerics which represents the lengths of the overlap
  private prepareCombinedSequence4Jump(element: any): CombinedSequence {
    let sequenceLength: number; // The length of the combined sequence
    let firstSequence = element.source().data("segmentData"); // The sequence before the jump
    let thirdSequence = element.target().data("segmentData"); // The sequence after the jump

    // Dislpay the distance of the jump as "..(distance).."
    let secondSequence = "..(" + element.data("distance") + ")..";

    // If the source orientation is "-", reverse complement the first sequence
    if (element.data("sourceOrientation") === "-") {
      firstSequence = this.reverseComplementSegmentData(firstSequence);
    }

    // If the target orientation is "-", reverse complement the third sequence
    if (element.data("targetOrientation") === "-") {
      thirdSequence = this.reverseComplementSegmentData(thirdSequence);
    }

    // If the distance of the jump is "*", the sequence length is "*"
    if (element.data("distance") === "*") {
      sequenceLength = element.data("distance");
    } else {
      sequenceLength =
        Number(element.data("distance")) +
        firstSequence.length +
        thirdSequence.length;
    }

    // Return the CombinedSequence object without the overlapNumerics property
    return {
      firstSequence,
      secondSequence,
      thirdSequence,
      sequenceLength,
      overlapNumerics: [],
    };
  }

  // This is a function that prepares a combined sequence for a containment.
  // It takes an element as an argument and returns a CombinedSequence object.
  // The CombinedSequence object has the following properties:
  // - firstSequence which represents the sequence before the target sequence
  // - secondSequence which represents the target sequence
  // - thirdSequence which represents the sequence after the target sequence
  // - sequenceLength which represents the length of the combined sequence
  // - overlapNumerics which represents the lengths of the overlap
  private prepareCombinedSequence4Containment(element: any): CombinedSequence {
    // container is the sequence that contains the target sequence
    let container = element.source().data("segmentData"); // The sequence that contains the target sequence (source sequence)

    // If the source orientation is "-", reverse complement the container
    if (element.data("sourceOrientation") === "-") {
      container = this.reverseComplementSegmentData(container);
    }

    // firstSequence is the sequence before the target sequence
    let firstSequence = container.substring(0, element.data("pos")); // The sequence before the target sequence

    let secondSequence = element.target().data("segmentData"); // The target sequence

    // If the target orientation is "-", reverse complement the target sequence
    if (element.data("targetOrientation") === "-") {
      secondSequence = this.reverseComplementSegmentData(secondSequence);
    }

    // thirdSequence is the sequence after the target sequence
    let thirdSequence = container.substring(
      element.data("pos") + secondSequence.length // The sequence after the target sequence
    );

    let sequenceLength = container.length;

    // Return the CombinedSequence object without the overlapNumerics property
    return {
      firstSequence,
      secondSequence,
      thirdSequence,
      sequenceLength,
      overlapNumerics: [],
    };
  }

  // This is a function that prepares a combined sequence for a link with an overlap.
  // It takes an element as an argument and returns a CombinedSequence object.
  // The CombinedSequence object has the following properties:
  // - firstSequence which represents the sequence before the overlap
  // - secondSequence which represents the overlap
  // - thirdSequence which represents the sequence after the overlap
  // - sequenceLength which represents the length of the combined sequence
  // - overlapNumerics which represents the lengths of the overlap
  private prepareCombinedSequence4OverlapedSequence(
    element: any,
    sourceData: string = undefined
  ): CombinedSequence {
    let firstSequence: string; // The sequence before the overlap

    // If the source data is provided, use the source data as the first sequence
    if (sourceData) {
      firstSequence = sourceData;
    } else {
      firstSequence = element.source().data("segmentData");
    }

    // If the source orientation is "-", reverse complement the first sequence
    if (element.data("sourceOrientation") === "-") {
      firstSequence = this.reverseComplementSegmentData(firstSequence);
    }

    let thirdSequence = element.target().data("segmentData"); // The sequence after the overlap

    // If the target orientation is "-", reverse complement the third sequence
    if (element.data("targetOrientation") === "-") {
      thirdSequence = this.reverseComplementSegmentData(thirdSequence);
    }

    let secondSequence = ""; // The sequence of the overlap

    // If the overlap is "*", the sequence length is the sum of the lengths of the first and third sequences
    if (element.data("overlap") === "*") {
      let sequenceLength = firstSequence.length + thirdSequence.length; // The length of the combined sequence

      return {
        firstSequence,
        secondSequence,
        thirdSequence,
        sequenceLength,
        overlapNumerics: [],
      };
    }
    // If the overlap is not "*", calculate the sequence
    else {
      return this.prepareOverlapSequence(
        element,
        firstSequence,
        secondSequence,
        thirdSequence,
        sourceData !== undefined // If the source data is provided, set isSourceDataProvided to true
      );
    }
  }

  // This is a function that prepares a combined sequence for an overlap.
  // It takes an element, the first sequence, the second sequence, and the third sequence as arguments and returns a CombinedSequence object.
  // The CombinedSequence object has the following properties:
  // - firstSequence which represents the sequence before the overlap
  // - secondSequence which represents the overlap
  // - thirdSequence which represents the sequence after the overlap
  // - sequenceLength which represents the length of the combined sequence
  // - overlapNumerics which represents the lengths of the overlap
  private prepareOverlapSequence(
    element: any,
    firstSequence: string,
    secondSequence: string,
    thirdSequence: string,
    isSourceDataProvided: boolean = false
  ): CombinedSequence {
    let overlapNumerics: number[] = []; // Array of numbers that represent the length of the overlap
    let overlapNumericsData: number[]; // Array of numbers that represent the length of the overlap
    let overlapIdentifiers: string[]; // Array of strings that represent the type of the overlap
    let overlapLengthSource = 0; // The length of the overlap in the source sequence
    let overlapLengthTarget = 0; // The length of the overlap in the target sequence
    let secondSequenceRealLength = 0; // The real length of the second sequence

    // Parse the overlap data
    overlapNumericsData = element
      .data("overlap")
      .split(OVERLAP_REGEX)
      .map((num: string) => {
        return Number(num);
      });

    // Remove the last element as it is an empty string
    overlapNumericsData.pop();

    // Calculate the real length of the second sequence
    overlapNumericsData.forEach((num: number) => {
      secondSequenceRealLength += num;
    });

    // Parse the overlap data to get the overlap identifiers
    overlapIdentifiers = element
      .data("overlap")
      .split(/[0-9]+/)
      .slice(1); // Remove the first element as it is an empty string

    // Calculate the lengths of the overlap in the source and target sequences
    // based on the overlap identifiers
    overlapIdentifiers.forEach((overlapIdentifier, index) => {
      // If the overlap identifier is "I", add the length to the target sequence
      // because it is an insertion in the target sequence
      if (overlapIdentifier === "I") {
        overlapLengthTarget += overlapNumericsData[index];
      }
      // If the overlap identifier is "D", "N", or "H", add the length to the source sequence
      // because it is a deletion in the source sequence
      else if (
        overlapIdentifier === "D" ||
        overlapIdentifier === "N" ||
        overlapIdentifier === "H"
      ) {
        overlapLengthSource += overlapNumericsData[index];
      }
      // If the overlap identifier is "M", "=", "X", or "S", add the length to both the source and target sequences
      // because it is a match or mismatch between the source and target sequences
      else if (
        overlapIdentifier === "M" ||
        overlapIdentifier === "=" ||
        overlapIdentifier === "X" ||
        overlapIdentifier === "S"
      ) {
        overlapLengthSource += overlapNumericsData[index];
        overlapLengthTarget += overlapNumericsData[index];
      } else {
        this.printConsoleUnknownOverlapIdentifier(element, overlapIdentifier);
      }
    });

    // Initialize the current overlap lengths in the source and target sequences
    let currentOverlapLengthSource = 0;
    let currentOverlapLengthTarget = 0;

    // Construct the second sequence based on the overlap identifiers and lengths
    overlapIdentifiers.forEach((overlapIdentifier, index) => {
      // If the overlap identifier is "I", add the overlap to the target sequence
      // because it is an insertion in the target sequence
      if (overlapIdentifier === "I") {
        // Add the overlap to the target sequence from the target sequence
        secondSequence += thirdSequence.substring(
          currentOverlapLengthTarget,
          currentOverlapLengthTarget + overlapNumericsData[index]
        );

        // Add the length of the overlap to the overlapNumerics array
        // to keep track of the lengths of the overlaps
        overlapNumerics.push(overlapNumericsData[index]);
        currentOverlapLengthTarget += overlapNumericsData[index];
      }
      // If the overlap identifier is "D", "N", or "H", add the overlap to the source sequence
      // because it is a deletion in the source sequence
      else if (
        overlapIdentifier === "D" ||
        overlapIdentifier === "N" ||
        overlapIdentifier === "H"
      ) {
        // Add the overlap to the source sequence from the source sequence
        // because it is a deletion in the source sequence
        // Calculate the deletion in the source sequence
        // depending on the overlap identifier and overlap length in the source sequence
        secondSequence += firstSequence.substring(
          firstSequence.length -
            overlapLengthSource +
            currentOverlapLengthSource,
          firstSequence.length -
            overlapLengthSource +
            currentOverlapLengthSource +
            overlapNumericsData[index]
        );

        // Add the length of the overlap to the overlapNumerics array
        // to keep track of the lengths of the overlaps
        overlapNumerics.push(overlapNumericsData[index]);
        currentOverlapLengthSource += overlapNumericsData[index];
      }
      // If the overlap identifier is "M", "=", "X", or "S", add the overlap to the source and target sequences
      // because it is a match or mismatch between the source and target sequences
      else if (
        overlapIdentifier === "=" ||
        overlapIdentifier === "S" ||
        overlapIdentifier === "M" ||
        overlapIdentifier === "X"
      ) {
        // Calculate the match or mismatch in the source sequence
        // depending on the overlap identifier and overlap length in the source sequence
        let sourceMatch = firstSequence.substring(
          firstSequence.length -
            overlapLengthSource +
            currentOverlapLengthSource,
          firstSequence.length -
            overlapLengthSource +
            currentOverlapLengthSource +
            overlapNumericsData[index]
        );

        // Calculate the match or mismatch in the target sequence
        // depending on the overlap identifier and overlap length in the target sequence
        let targetMatch = thirdSequence.substring(
          currentOverlapLengthTarget,
          currentOverlapLengthTarget + overlapNumericsData[index]
        );

        // Check if the match or mismatch is a match or mismatch
        // based on the overlap identifier and the match or mismatch in the source and target sequences
        let matches = true;
        if (
          overlapIdentifier === "X" ||
          overlapIdentifier === "S" ||
          (overlapIdentifier === "M" && targetMatch !== sourceMatch)
        ) {
          matches = false;
        }

        // Add the match or mismatch to the second sequence
        // depending on whether it is a match or mismatch
        // if isSourceDataProvided is true, add the source match to the second sequence
        // because the source data is provided, we don't want to display the target match
        if (matches || isSourceDataProvided) {
          secondSequence += sourceMatch;
          overlapNumerics.push(sourceMatch.length);
        }
        // If it is a mismatch, add the match and mismatch to the second sequence
        // in the format "[sourceMatch|targetMatch]"
        else {
          secondSequence += "[" + sourceMatch + "|" + targetMatch + "]";
          overlapNumerics.push(3 + sourceMatch.length + targetMatch.length);
        }

        // Add the length of the overlap to the overlapNumerics array
        // to keep track of the lengths of the overlaps
        currentOverlapLengthTarget += overlapNumericsData[index];
        currentOverlapLengthSource += overlapNumericsData[index];
      } else {
        this.printConsoleUnknownOverlapIdentifier(element, overlapIdentifier);
      }
    });

    // Construct the first and third sequences based on the overlap lengths
    // by removing the overlap from the source and target sequences
    firstSequence = firstSequence.substring(
      0,
      firstSequence.length - overlapLengthSource
    );
    thirdSequence = thirdSequence.substring(overlapLengthTarget);

    // Calculate the length of the combined sequence
    let sequenceLength =
      firstSequence.length + secondSequenceRealLength + thirdSequence.length;

    return {
      firstSequence,
      secondSequence,
      thirdSequence,
      sequenceLength,
      overlapNumerics,
    };
  }

  // This is a function that prepares a combined sequence for an element.
  // It takes an element as argument and returns a CombinedSequence object.
  // sourceData is an optional argument that represents the source data of the element.
  // sourceData is used to calculate the combined sequence for predefined source data.
  // The CombinedSequence object has the following properties:
  // - firstSequence which represents the sequence before the element
  // - secondSequence which represents the element
  // - thirdSequence which represents the sequence after the element
  // - sequenceLength which represents the length of the combined sequence
  // - overlapNumerics which represents the lengths of the overlap
  prepareCombinedSequence(
    element: any,
    sourceData: string = undefined
  ): CombinedSequence {
    // For Jumps, check if the element has a distance
    if (element.data("distance")) {
      return this.prepareCombinedSequence4Jump(element);
    }
    // For Containments, check if the element has a pos
    else if (element.data("pos")) {
      return this.prepareCombinedSequence4Containment(element);
    }
    // For Links with Overlaps
    else if (element.data("overlap")) {
      return this.prepareCombinedSequence4OverlapedSequence(
        element,
        sourceData
      );
    }
    // Unknown element
    else {
      console.log("Unknown element");
      console.log(element);
    }
  }

  // This is a function that prepares the sequence data for the paths
  prepareFastaData4SequenceArray(sequenceData: string[]): string {
    let fastaData = "";
    for (let i = 0; i < sequenceData.length; i += 2) {
      // If the sequence data is not empty, add it to the fasta data
      // in the format ">segmentName\nsegmentData\n"
      if (sequenceData[i] && sequenceData[i + 1]) {
        fastaData += ">" + sequenceData[i] + "\n" + sequenceData[i + 1] + "\n";
      }
    }
    return fastaData;
  }

  // Gets the sequence data of the nodes and returns as an array of strings
  nodeDatas2SequenceArray(nodes: any) {
    let sequenceData: string[] = [];
    nodes.forEach((element: any) => {
      sequenceData.push(element.data("segmentName"));
      sequenceData.push(element.data("segmentData"));
    });
    return sequenceData;
  }

  pushSequenceData2Array(element: any, array: string[]) {
    array.push(element.data("segmentName"));
    array.push(element.data("segmentData"));
  }
}
