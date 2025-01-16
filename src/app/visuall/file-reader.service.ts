import { Injectable } from "@angular/core";
import {
  GFAContainment,
  GFAData,
  GFAJump,
  GFALink,
  GFAPath,
  GFAPathData,
  GFAPathEdge,
  GFAPathSegment,
  GFASegment,
  GFASegmentData,
  GFAWalk,
  GFAWalkData,
  GFAWalkEdge,
  GFAWalkSegment,
} from "./db-service/data-types";
import { GlobalVariableService } from "./global-variable.service";
@Injectable({
  providedIn: "root",
})
export class FileReaderService {
  previousBatchRemainders: string; // Save the remainder of the previous batch to be added to the next batch
  readLineCount: number = 0; // Count the number of lines read from the GFA file

  constructor(private _g: GlobalVariableService) {}

  readTxtFile(file: File, callback: (s: string) => void) {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      try {
        callback(fileReader.result as string);
      } catch (error) {
        console.error("Given file is not suitable.", error);
      }
    };
    fileReader.onerror = (error) => {
      console.error("File could not be read!", error);
      fileReader.abort();
    };
    fileReader.readAsText(file);
  }

  private createSegmentFromGFA(segmentLine: string): GFASegment {
    let segmentLineTabSeperated = segmentLine
      .split(/\t/)
      .map((part) => part.trim());
    let segment: GFASegment = {
      segmentName: "",
      id: "",
      segmentData: "",
      segmentLength: 0,
    };
    segment.segmentName = segmentLineTabSeperated[1];
    segment.id = segmentLineTabSeperated[1];
    segment.segmentData = segmentLineTabSeperated[2];
    segment.segmentLength = segmentLineTabSeperated[2].length;
    for (let i = 3; i < segmentLineTabSeperated.length; i++) {
      let optionalField = (segmentLineTabSeperated[i] as string).trim();
      if (optionalField.startsWith("LN")) {
        segment.segmentLength = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("RC")) {
        segment.readCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("FC")) {
        segment.fragmentCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("KC")) {
        segment.kmerCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("SH")) {
        segment.Sha256Checksum = optionalField;
      } else if (optionalField.startsWith("UR")) {
        segment.UriOrLocalSystemPath = optionalField;
      } else if (optionalField.startsWith("SN")) {
        segment.stableSequenceName = optionalField.substring(5);
      } else if (optionalField.startsWith("SO")) {
        segment.stableSequenceOffset = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("SR")) {
        segment.stableSequenceRank = Number(optionalField.substring(5));
      } else {
        console.log("This field is not parsed: " + optionalField);
      }
    }

    return segment;
  }

  // Convert the orientation from GFA format to the format used in the graph
  // + or > indicates forward orientation, - or < indicates reverse orientation
  private convertOrientation(orientation: string): string {
    if (orientation === "+" || orientation === ">") {
      return "forward";
    } else {
      return "reverse";
    }
  }

  private createJumpFromGFA(jumpLine: string): GFAJump {
    let jumpLineTabSeperated = jumpLine.split(/\t/).map((part) => part.trim());
    let jump: GFAJump = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      distance: "",
    };
    jump.source = jumpLineTabSeperated[1];
    jump.sourceOrientation = this.convertOrientation(jumpLineTabSeperated[2]);
    jump.target = jumpLineTabSeperated[3];
    jump.targetOrientation = this.convertOrientation(jumpLineTabSeperated[4]);
    for (let i = 4; i < jumpLineTabSeperated.length; i++) {
      let optionalField = (jumpLineTabSeperated[i] as string).trim();
      if (optionalField.startsWith("SC")) {
        jump.indirectShortcutConnections = Number(optionalField.substring(5));
      } else {
        jump.distance = optionalField;
      }
    }
    return jump;
  }

  private createContainmentFromGFA(containmentLine: string): GFAContainment {
    let containmentLineTabSeperated = containmentLine
      .split(/\t/)
      .map((part) => part.trim());
    let containment: GFAContainment = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      pos: 0,
      overlap: "",
    };
    containment.source = containmentLineTabSeperated[1];
    containment.sourceOrientation = this.convertOrientation(
      containmentLineTabSeperated[2]
    );
    containment.target = containmentLineTabSeperated[3];
    containment.targetOrientation = this.convertOrientation(
      containmentLineTabSeperated[4]
    );
    containment.pos = Number(containmentLineTabSeperated[5]);
    containment.overlap = containmentLineTabSeperated[6];
    for (let i = 4; i < containmentLineTabSeperated.length; i++) {
      let optionalField = (containmentLineTabSeperated[i] as string).trim();
      if (optionalField.startsWith("RC")) {
        containment.readCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("NM")) {
        containment.numberOfMismatchesOrGaps = Number(
          optionalField.substring(5)
        );
      } else if (optionalField.startsWith("ID")) {
        containment.edgeIdentifier = optionalField;
      }
    }

    return containment;
  }

  private createLinkFromGFA(linkLine: string): GFALink {
    let linkLineTabSeperated = linkLine.split(/\t/).map((part) => part.trim());
    let link: GFALink = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      overlap: "",
    };

    link.source = linkLineTabSeperated[1];
    link.sourceOrientation = this.convertOrientation(linkLineTabSeperated[2]);
    link.target = linkLineTabSeperated[3];
    link.targetOrientation = this.convertOrientation(linkLineTabSeperated[4]);

    for (let i = 4; i < linkLineTabSeperated.length; i++) {
      let optionalField = (linkLineTabSeperated[i] as string).trim();
      if (optionalField.startsWith("MQ")) {
        link.mappingQuality = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("NM")) {
        link.numberOfMismatchesOrGaps = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("RC")) {
        link.readCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("FC")) {
        link.fragmentCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("KC")) {
        link.kmerCount = Number(optionalField.substring(5));
      } else if (optionalField.startsWith("ID")) {
        link.edgeIdentifier = optionalField;
      } else {
        link.overlap = optionalField;
      }
    }

    return link;
  }

  // Create a walk object from a GFA walk line
  private createWalkFromGFA(walkLine: string): GFAWalkData {
    // Split the walk line into tab-separated parts and trim each part
    let walkLineTabSeperated = walkLine.split(/\t/).map((part) => part.trim());

    // Create a new walk object and set its properties
    let walk: GFAWalk = {
      sampleIdentifier: "",
      haplotypeIndex: "",
      sequenceIdentifier: "",
      sequenceStart: "",
      sequenceEnd: "",
      walk: "",
    };

    // Set the properties of the walk object from the tab-separated parts of the walk line
    walk.sampleIdentifier = walkLineTabSeperated[1];
    walk.haplotypeIndex = walkLineTabSeperated[2];
    walk.sequenceIdentifier = walkLineTabSeperated[3];
    walk.sequenceStart = walkLineTabSeperated[4];
    walk.sequenceEnd = walkLineTabSeperated[5];
    walk.walk = walkLineTabSeperated[6];

    // Extract the segment names from the walk string and split them into an array
    // to be added to particular segments in the graph
    // > indicates the forward orientation and < indicates the reverse orientation
    let segmentNamesArray: string[] = walk.walk
      .split(/[<>]/)
      .filter((s) => "" !== s); // Filter out empty strings

    // Extract the segment orientations from the walk string and split them into an array
    let segmentOrientationsArray: string[] = walk.walk
      .split(/[^<>]/)
      .filter((s) => "" !== s) // Filter out empty strings
      .map((s) => this.convertOrientation(s)); // Map > to forward and < to reverse

    // Transform the extracted data to string objects that can be understood by cypher transformer helper function
    let segments: GFAWalkSegment[] = segmentNamesArray.map((segmentName) => {
      return {
        sampleIdentifier: walk.sampleIdentifier,
        segmentName: segmentName,
      };
    });

    // Create the edges from the extracted segment names and orientations
    let edges: GFAWalkEdge[] = [];
    for (let i = 0; i < segmentNamesArray.length - 1; i++) {
      edges.push({
        sampleIdentifier: walk.sampleIdentifier,
        source: segmentNamesArray[i],
        sourceOrientation: segmentOrientationsArray[i],
        target: segmentNamesArray[i + 1],
        targetOrientation: segmentOrientationsArray[i + 1],
      });
    }

    return { walk, segments, edges };
  }

  // Create a path object from a GFA path line
  private createPathFromGFA(pathLine: string): GFAPathData {
    // Split the path line into tab-separated parts and trim each part
    let pathLineTabSeperated = pathLine.split(/\t/).map((part) => part.trim());
    // Create a new path object and set its properties
    let path: GFAPath = {
      pathName: "",
      segmentNames: "",
      overlaps: "",
    };

    // Set the properties of the path object from the tab-separated parts of the path line
    path.pathName = pathLineTabSeperated[1];
    path.segmentNames = pathLineTabSeperated[2];
    path.overlaps = pathLineTabSeperated[3];

    // Extract the segment names from the path string and split them into an array
    // to be added to particular segments in the graph
    let segmentNamesArray: string[] = path.segmentNames
      .split(/[+,;\-]/)
      .filter((s) => "" !== s); // Filter out empty strings

    // Extract the segment orientations from the path string and split them into an array
    let segmentOrientationsArray: string[] = path.segmentNames
      .split(/[^+\-]/)
      .filter((s) => "" !== s) // Filter out empty strings
      .map((s) => this.convertOrientation(s)); // Map + to forward and - to reverse

    // Transform the extracted data to string objects that can be understood by cypher transformer helper function
    let segments: GFAPathSegment[] = segmentNamesArray.map((segmentName) => {
      return {
        pathName: path.pathName,
        segmentName: segmentName,
      };
    });

    let edges: GFAPathEdge[] = [];

    // Handle the case where the overlaps are separated by semicolons instead of commas in the path line representing the jumps
    if (pathLineTabSeperated[2].indexOf(";") !== -1) {
      // Split the segment names and overlaps into arrays
      for (let i = 0; i < segmentNamesArray.length - 1; i++) {
        // Extract the overlap between the segments
        let overlap =
          path.overlaps.split(",")[i].indexOf("J") !== -1 ? "J" : undefined;

        // Add the edge to the edges array
        edges.push({
          pathName: path.pathName,
          source: segmentNamesArray[i],
          sourceOrientation: segmentOrientationsArray[i],
          target: segmentNamesArray[i + 1],
          targetOrientation: segmentOrientationsArray[i + 1],
          overlap: overlap,
        });
      }

      return { path, segments, edges };
    }

    // Create the edges from the extracted segment names and orientations
    for (let i = 0; i < segmentNamesArray.length - 1; i++) {
      // Add the edge to the edges array
      edges.push({
        pathName: path.pathName,
        source: segmentNamesArray[i],
        sourceOrientation: segmentOrientationsArray[i],
        target: segmentNamesArray[i + 1],
        targetOrientation: segmentOrientationsArray[i + 1],
      });
    }

    return { path, segments, edges };
  }

  // Handle the previous batch remainders by adding them to the next batch of lines to send
  // This function gets the combined text of the previous batch and the current batch of lines
  // and splits the text into lines to be sent by checking the total character length of the lines to send and the last line
  private handlePreviousBatchRemainders(combinedText: string): string[] {
    // Split the text into lines as the GFA file is line-based
    let linesToSend = combinedText.split(/\n/);

    if (linesToSend.length > 1) {
      // Calculate the character length of the lines to send
      // If the total character length of the lines to send exceeds the maximum character length of the batch
      // then add the remainder of the current batch to the next batch
      // Do not count the last line as it may be incomplete and should be added to the next batch
      let totalLength = 0;
      let okayToSendIndex = 0;
      for (let i = 0; i < linesToSend.length - 1; i++) {
        totalLength += linesToSend[i].length;

        // Check if the total character length of the lines to send exceeds the maximum character length of the batch
        if (
          totalLength <=
          this._g.userPreferences.sizeOfNeo4jQueryBatchesInCharacters.getValue()
        ) {
          okayToSendIndex = i;
        } else {
          break;
        }
      }

      // Save the remainder of the current batch to be added to the next batch
      this.previousBatchRemainders = linesToSend
        .slice(okayToSendIndex + 1)
        .join("\n");

      // Update the lines to send by taking only the lines that can be sent
      linesToSend = linesToSend.slice(0, okayToSendIndex + 1);
    } else if (linesToSend.length === 1) {
      // If only one line is present, add it to the previous batch remainders
      this.previousBatchRemainders = linesToSend[0];
      linesToSend = [];
    } else {
      // Check if the lines to send are empty, add the previous batch remainders to the lines to send
      linesToSend = this.previousBatchRemainders.split(/\n/);
      this.previousBatchRemainders = "";
    }

    return linesToSend;
  }

  // Read a GFA file and process it in chunks
  // This function reads the GFA file in chunks and processes each chunk asynchronously
  // The GFA file is read line by line and split into chunks of lines
  // Each chunk is then processed asynchronously
  // The callback function is called with the parsed GFA data after each chunk is processed
  // TextDecoder is used to decode the binary data from the GFA file into text and process it in batches
  async readGFAFile(
    gfaFile: any,
    callback: (GFAData: GFAData) => Promise<any> // Callback function to process the parsed GFA data
  ) {
    const reader = gfaFile.stream().getReader(); // Get a reader for the stream
    const decoder = new TextDecoder("utf-8"); // Create a new TextDecoder

    // Save the remainder of the previous batch to be added to the next batch
    // This is necessary because the GFA file is line-based and the last line and remainder of a batch may be incomplete
    this.previousBatchRemainders = "";

    // Initialize the number of lines read from the GFA file
    this.readLineCount = 0;

    // Process each batch of lines read from the GFA file
    const processBatch = async ({ done, value }) => {
      if (done && this.previousBatchRemainders === "") {
        console.log("GFA file read successfully");
        this._g.statusMessage.next("GFA file read successfully");
        return;
      }

      // Get the lines to send from the combined text of the previous batch and the current batch of lines
      // Split the text into lines as the GFA file is line-based and handle the previous batch remainders
      let linesToSend = this.handlePreviousBatchRemainders(
        this.previousBatchRemainders + decoder.decode(value, { stream: true })
      );

      // Increment the number of lines read from the GFA file
      this.readLineCount += linesToSend.length;

      // Parse the lines to create the GFA data
      let GFAData: GFAData = this.parseGFA(linesToSend);

      let GFADataChunks: GFAData[] = [];

      // Distribute the GFA data equally into chunks

      // Initialize counters for the number of objects taken for each type of object (line)
      let segmentsTaken = 0;
      let segmentsDataTaken = 0;
      let linksTaken = 0;
      let jumpsTaken = 0;
      let containmentsTaken = 0;
      let pathsTaken = 0;
      let walksTaken = 0;
      let walkSegmentsTaken = 0;
      let walkEdgesTaken = 0;
      let pathSegmentsTaken = 0;
      let pathEdgesTaken = 0;

      let totalTaken = 0; // Initialize the total number of objects taken

      // Calculate the total size of the GFA data
      let totalSize =
        GFAData.segments.length +
        GFAData.segmentsData.length +
        GFAData.links.length +
        GFAData.jumps.length +
        GFAData.containments.length +
        GFAData.walks.length +
        GFAData.walkSegments.length +
        GFAData.walkEdges.length +
        GFAData.paths.length +
        GFAData.pathSegments.length +
        GFAData.pathEdges.length;

      // Create equal chunks of GFA data by checking the counters for each type of object
      while (totalTaken < totalSize) {
        // Create a new chunk of GFA data
        let chunk: GFAData = {
          segments: [],
          segmentsData: [],
          links: [],
          jumps: [],
          containments: [],
          paths: [],
          walks: [],
          walkSegments: [],
          walkEdges: [],
          pathSegments: [],
          pathEdges: [],
        };

        // Split the GFAData into chunks, each chunk has equal amount of objects
        // Do not forget Path and Path lines create more than one objects (lines), themselves + amount of segments in them
        // Size of each chunk in lines (default: 30)
        let toTake =
          this._g.userPreferences.sizeOfNeo4jQueryBatchesInLines.getValue();

        function calculateElementNumber2Take(elements: any[], taken: number) {
          return Math.min(toTake, elements.length - taken);
        }

        // Take segments
        if (segmentsTaken < GFAData.segments.length && toTake > 0) {
          // Calculate the number of segments to take
          let toTakeSegment = calculateElementNumber2Take(
            GFAData.segments,
            segmentsTaken
          );

          // Take the next toTakeSegment segments from the GFA data
          chunk.segments = GFAData.segments.slice(
            segmentsTaken,
            segmentsTaken + toTakeSegment
          );

          // Update the counter for the number of segments taken
          segmentsTaken += toTakeSegment;
          totalTaken += toTakeSegment;
          toTake -= toTakeSegment;
        }

        // Take segment data
        if (segmentsDataTaken < GFAData.segmentsData.length && toTake > 0) {
          // Calculate the number of segment data to take
          let toTakeSegmentData = calculateElementNumber2Take(
            GFAData.segmentsData,
            segmentsDataTaken
          );

          // Take the next toTakeSegmentData segment data from the GFA data
          chunk.segmentsData = GFAData.segmentsData.slice(
            segmentsDataTaken,
            segmentsDataTaken + toTakeSegmentData
          );

          // Update the counter for the number of segment data taken
          segmentsDataTaken += toTakeSegmentData;
          totalTaken += toTakeSegmentData;
          toTake -= toTakeSegmentData;
        }

        // Take links
        if (linksTaken < GFAData.links.length && toTake > 0) {
          // Calculate the number of links to take
          let toTakeLink = calculateElementNumber2Take(
            GFAData.links,
            linksTaken
          );

          // Take the next toTakeLink links from the GFA data
          chunk.links = GFAData.links.slice(
            linksTaken,
            linksTaken + toTakeLink
          );

          // Update the counter for the number of links taken
          linksTaken += toTakeLink;
          totalTaken += toTakeLink;
          toTake -= toTakeLink;
        }

        // Take jumps
        if (jumpsTaken < GFAData.jumps.length && toTake > 0) {
          // Calculate the number of jumps to take
          let toTakeJump = calculateElementNumber2Take(
            GFAData.jumps,
            jumpsTaken
          );

          // Take the next toTakeJump jumps from the GFA data
          chunk.jumps = GFAData.jumps.slice(
            jumpsTaken,
            jumpsTaken + toTakeJump
          );

          // Update the counter for the number of jumps taken
          jumpsTaken += toTakeJump;
          totalTaken += toTakeJump;
          toTake -= toTakeJump;
        }

        // Take containments
        if (containmentsTaken < GFAData.containments.length && toTake > 0) {
          // Calculate the number of containments to take
          let toTakeContainment = calculateElementNumber2Take(
            GFAData.containments,
            containmentsTaken
          );

          // Take the next toTakeContainment containments from the GFA data
          chunk.containments = GFAData.containments.slice(
            containmentsTaken,
            containmentsTaken + toTakeContainment
          );

          // Update the counter for the number of containments taken
          containmentsTaken += toTakeContainment;
          totalTaken += toTakeContainment;
          toTake -= toTakeContainment;
        }

        // Take walks
        if (walksTaken < GFAData.walks.length && toTake > 0) {
          // Calculate the number of walks to take
          let toTakeWalk = calculateElementNumber2Take(
            GFAData.walks,
            walksTaken
          );

          // Take the next toTakeWalk walks from the GFA data
          chunk.walks = GFAData.walks.slice(
            walksTaken,
            walksTaken + toTakeWalk
          );

          // Update the counter for the number of walks taken
          walksTaken += toTakeWalk;
          totalTaken += toTakeWalk;
          toTake -= toTakeWalk;
        }

        // Take walk segments
        if (walkSegmentsTaken < GFAData.walkSegments.length && toTake > 0) {
          // Calculate the number of walk segments to take
          let toTakeWalkSegment = calculateElementNumber2Take(
            GFAData.walkSegments,
            walkSegmentsTaken
          );

          // Take the next toTakeWalkSegment walk segments from the GFA data
          chunk.walkSegments = GFAData.walkSegments.slice(
            walkSegmentsTaken,
            walkSegmentsTaken + toTakeWalkSegment
          );

          // Update the counter for the number of walk segments taken
          walkSegmentsTaken += toTakeWalkSegment;
          totalTaken += toTakeWalkSegment;
          toTake -= toTakeWalkSegment;
        }

        // Take walk edges
        if (walkEdgesTaken < GFAData.walkEdges.length && toTake > 0) {
          // Calculate the number of walk edges to take
          let toTakeWalkEdge = calculateElementNumber2Take(
            GFAData.walkEdges,
            walkEdgesTaken
          );

          // Take the next toTakeWalkEdge walk edges from the GFA data
          chunk.walkEdges = GFAData.walkEdges.slice(
            walkEdgesTaken,
            walkEdgesTaken + toTakeWalkEdge
          );

          // Update the counter for the number of walk edges taken
          walkEdgesTaken += toTakeWalkEdge;
          totalTaken += toTakeWalkEdge;
          toTake -= toTakeWalkEdge;
        }

        // Take paths
        if (pathsTaken < GFAData.paths.length && toTake > 0) {
          // Calculate the number of paths to take
          let toTakePath = calculateElementNumber2Take(
            GFAData.paths,
            pathsTaken
          );

          // Take the next toTakePath paths from the GFA data
          chunk.paths = GFAData.paths.slice(
            pathsTaken,
            pathsTaken + toTakePath
          );

          // Update the counter for the number of paths taken
          pathsTaken += toTakePath;
          totalTaken += toTakePath;
          toTake -= toTakePath;
        }

        // Take path segments
        if (pathSegmentsTaken < GFAData.pathSegments.length && toTake > 0) {
          // Calculate the number of path segments to take
          let toTakePathSegment = calculateElementNumber2Take(
            GFAData.pathSegments,
            pathSegmentsTaken
          );

          // Take the next toTakePathSegment path segments from the GFA data
          chunk.pathSegments = GFAData.pathSegments.slice(
            pathSegmentsTaken,
            pathSegmentsTaken + toTakePathSegment
          );

          // Update the counter for the number of path segments taken
          pathSegmentsTaken += toTakePathSegment;
          totalTaken += toTakePathSegment;
          toTake -= toTakePathSegment;
        }

        // Take path edges
        if (pathEdgesTaken < GFAData.pathEdges.length && toTake > 0) {
          // Calculate the number of path edges to take
          let toTakePathEdge = calculateElementNumber2Take(
            GFAData.pathEdges,
            pathEdgesTaken
          );

          // Take the next toTakePathEdge path edges from the GFA data
          chunk.pathEdges = GFAData.pathEdges.slice(
            pathEdgesTaken,
            pathEdgesTaken + toTakePathEdge
          );

          // Update the counter for the number of path edges taken
          pathEdgesTaken += toTakePathEdge;
          totalTaken += toTakePathEdge;
          toTake -= toTakePathEdge;
        }

        // Add the chunk to the GFADataChunks array
        GFADataChunks.push(chunk);
      }

      // Process each chunk asynchronously
      // Read the next batch of lines from the GFA file and process it
      // This is done recursively until the end of the file is reached
      await processChunks(GFADataChunks).then(() => {
        console.log("Processed batch " + this.readLineCount + " lines");
        this._g.statusMessage.next(
          "Importing GFA sample, processed batch " +
            this.readLineCount +
            " lines..."
        );

        // Continue reading the GFA file by processing the next batch of lines
        return reader.read().then(processBatch).catch(processError);
      });
    };

    // Process each chunk of lines read from the GFA file asynchronously using the executeLines function
    const processChunks = async (chunks: GFAData[]) => {
      for (let i = 0; i < chunks.length; i++) {
        await executeLines(chunks[i]); // Execute the lines in each chunk asynchronously
      }
    };

    // Execute the lines in each chunk asynchronously
    // This function simulates asynchronous processing by waiting for a promise to resolve
    // The callback function is called with the parsed GFA data after each chunk is processed
    const executeLines = async (GFAData: GFAData): Promise<void> => {
      return new Promise((resolve) => {
        // Call the callback function
        callback(GFAData).then(() => {
          resolve(); // Resolve the promise after processing the chunk
        });
      });
    };

    // Process any errors that occur while reading the GFA file
    const processError = (reason: any) => {
      console.error("Error reading GFA file", reason);
      this._g.statusMessage.next("Error reading GFA file");
      reader.cancel();
    };

    // Start reading the GFA file by processing the first batch of lines asynchronously
    reader.read().then(processBatch).catch(processError);
  }

  // Read a GFA sample and process it synchronously in one go without splitting it into chunks
  readGFASample(
    gfaSample: string,
    callback: (GFAData: GFAData) => Promise<void>
  ) {
    let seperatedGFASample = gfaSample.split(/\n/);

    // Parse the GFA sample and call the callback function
    callback(this.parseGFA(seperatedGFASample)).then(() => {
      console.log("Processed GFA sample");
      this._g.statusMessage.next("Processed GFA sample");
    });
  }

  parseGFA(lines: string[]): GFAData {
    let GFAData: GFAData = {
      segments: [],
      segmentsData: [],
      links: [],
      jumps: [],
      containments: [],
      paths: [],
      walks: [],
      walkSegments: [],
      walkEdges: [],
      pathSegments: [],
      pathEdges: [],
    };

    let lineCount = 0;
    lines.forEach((line) => {
      lineCount++;
      if (!line) {
        console.log("Line " + lineCount + " is empty");
      } else if (line[0] === "S") {
        GFAData.segments.push(this.createSegmentFromGFA(line));
      } else if (line[0] === "L") {
        GFAData.links.push(this.createLinkFromGFA(line));
      } else if (line[0] === "J") {
        GFAData.jumps.push(this.createJumpFromGFA(line));
      } else if (line[0] === "C") {
        GFAData.containments.push(this.createContainmentFromGFA(line));
      } else if (line[0] === "P") {
        let pathData: GFAPathData = this.createPathFromGFA(line);
        GFAData.paths.push(pathData.path);
        GFAData.pathSegments = GFAData.pathSegments.concat(pathData.segments);
        GFAData.pathEdges = GFAData.pathEdges.concat(pathData.edges);
      } else if (line[0] === "W") {
        let walkData: GFAWalkData = this.createWalkFromGFA(line);
        GFAData.walks.push(walkData.walk);
        GFAData.walkSegments = GFAData.walkSegments.concat(walkData.segments);
        GFAData.walkEdges = GFAData.walkEdges.concat(walkData.edges);
      } else if (line[0] === "H") {
        // version of GFA file
      } else if (line[0] === "#") {
        // GFA file comments
      } else {
        console.log(
          "tag " + line[0] + " is not implemented in line " + lineCount
        );
      }
    });

    // If any segments' data are too large to be taken in one go
    // Create a segmentData object for each segment and take them in chunks
    for (let i = 0; i < GFAData.segments.length; i++) {
      // Calculate the number of segmentData objects to create for each segment based on the size of the segmentData
      // remove 1, as the first chunk will be at the segment
      let segmentDataCount = Math.ceil(
        GFAData.segments[i].segmentData.length /
          this._g.userPreferences.segmentDataSizeQueryLimit.getValue() -
          1
      );

      // Create segmentData objects for each segment, this is done by clipping the segmentData into chunks
      // first chunk will be at Segment, other data will be put into segmentData objects
      while (segmentDataCount > 0) {
        let segmentData: GFASegmentData = {
          segmentName: GFAData.segments[i].segmentName,
          segmentData: "",
        };

        // Calculate the size of the segmentData to take
        let toTakeLength = Math.min(
          this._g.userPreferences.segmentDataSizeQueryLimit.getValue(),
          GFAData.segments[i].segmentData.length -
            this._g.userPreferences.segmentDataSizeQueryLimit.getValue()
        );

        // Take the segmentData from the segment
        segmentData.segmentData = GFAData.segments[i].segmentData.substring(
          this._g.userPreferences.segmentDataSizeQueryLimit.getValue(),
          this._g.userPreferences.segmentDataSizeQueryLimit.getValue() +
            toTakeLength
        );

        // Add the segmentData to the GFAData
        GFAData.segmentsData.push(segmentData);

        // Update the segments data
        GFAData.segments[i].segmentData =
          GFAData.segments[i].segmentData.substring(
            0,
            this._g.userPreferences.segmentDataSizeQueryLimit.getValue()
          ) +
          GFAData.segments[i].segmentData.substring(
            this._g.userPreferences.segmentDataSizeQueryLimit.getValue() +
              toTakeLength
          );

        segmentDataCount--;
      }
    }

    return GFAData;
  }
}
