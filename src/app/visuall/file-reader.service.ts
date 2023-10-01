import { Injectable } from "@angular/core";
import {
  GFASegment,
  GFAJump,
  GFAContainment,
  GFALink,
  GFAData,
  GFAPath,
} from "./db-service/data-types";
@Injectable({
  providedIn: "root",
})
export class FileReaderService {
  constructor() {}

  readTxtFile(file: File, cb: (s: string) => void) {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      try {
        cb(fileReader.result as string);
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
    let segmentLineTabSeperated = segmentLine.split(/\t/);
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
      let optField = (segmentLineTabSeperated[i] as string).trim();
      if (optField.startsWith("LN")) {
        segment.segmentLength = Number(optField.substring(5));
      } else if (optField.startsWith("RC")) {
        segment["readCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("FC")) {
        segment["fragmentCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("KC")) {
        segment["kmerCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("SH")) {
        segment["SHA256Checksum"] = optField;
      } else if (optField.startsWith("UR")) {
        segment["URIorLocalSystemPath"] = optField;
      } else {
        console.log("This field is not parsed: " + optField);
      }
    }

    return segment;
  }

  private createJumpFromGFA(jumpLine: string): GFAJump {
    let jumpLineTabSeperated = jumpLine.split(/\t/);
    let jump: GFAJump = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      distance: "",
    };
    jump.source = jumpLineTabSeperated[1];
    jump.sourceOrientation = jumpLineTabSeperated[2];
    jump.target = jumpLineTabSeperated[3];
    jump.targetOrientation = jumpLineTabSeperated[4];
    for (let i = 4; i < jumpLineTabSeperated.length; i++) {
      let optField = (jumpLineTabSeperated[i] as string).trim();
      if (optField.startsWith("SC")) {
        jump["indirectShortcutConnections"] = Number(optField.substring(5));
      } else {
        jump.distance = optField;
      }
    }
    return jump;
  }

  private createContainmentFromGFA(containmentLine: string): GFAContainment {
    let containmentLineTabSeperated = containmentLine.split(/\t/);
    let containment: GFAContainment = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      pos: 0,
      overlap: "",
    };
    containment.source = containmentLineTabSeperated[1];
    containment.sourceOrientation = containmentLineTabSeperated[2];
    containment.target = containmentLineTabSeperated[3];
    containment.targetOrientation = containmentLineTabSeperated[4];
    containment.pos = Number(containmentLineTabSeperated[5]);
    containment.overlap = containmentLineTabSeperated[6];
    for (let i = 4; i < containmentLineTabSeperated.length; i++) {
      let optField = (containmentLineTabSeperated[i] as string).trim();
      if (optField.startsWith("RC")) {
        containment["readCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("NM")) {
        containment["numberOfMismatchesOrGaps"] = Number(optField.substring(5));
      } else if (optField.startsWith("ID")) {
        containment["edgeIdentifier"] = optField;
      }
    }

    return containment;
  }

  private createLinkFromGFA(linkLine: string): GFALink {
    let linkLineTabSeperated = linkLine.split(/\t/);
    let link: GFALink = {
      source: "",
      sourceOrientation: "",
      target: "",
      targetOrientation: "",
      overlap: "",
    };

    link.source = linkLineTabSeperated[1];
    link.sourceOrientation = linkLineTabSeperated[2];
    link.target = linkLineTabSeperated[3];
    link.targetOrientation = linkLineTabSeperated[4];

    for (let i = 4; i < linkLineTabSeperated.length; i++) {
      let optField = (linkLineTabSeperated[i] as string).trim();
      if (optField.startsWith("MQ")) {
        link["mappingQuality"] = Number(optField.substring(5));
      } else if (optField.startsWith("NM")) {
        link["numberOfMismatchesOrGaps"] = Number(optField.substring(5));
      } else if (optField.startsWith("RC")) {
        link["readCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("FC")) {
        link["fragmentCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("KC")) {
        link["kmerCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("ID")) {
        link["edgeIdentifier"] = optField;
      } else {
        link.overlap = optField;
      }
    }

    return link;
  }

  private createPathFromGFA(pathLine: string): GFAPath {
    let pathLineTabSeperated = pathLine.split(/\t/);
    let path: GFAPath = {
      pathName: "",
      segmentNames: "",
      overlaps: "",
    };

    path.pathName = pathLineTabSeperated[1];
    path.segmentNames = pathLineTabSeperated[2];
    path.overlaps = pathLineTabSeperated[3];

    return path;
  }

  readGFAFile(gfaFile: File, cb: (GFAData: GFAData) => void) {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      try {
        const fileContent = e.target.result;

        cb(this.parseGFA(fileContent as string));
      } catch (error) {
        console.error("Given GFA file is not suitable.", error);
      }
    };

    fileReader.onerror = (error) => {
      console.error("GFA File could not be read!", error);
      fileReader.abort();
    };

    fileReader.readAsText(gfaFile);
  }

  readGFASample(gfaSample: string, cb: (GFAData: GFAData) => void) {
    cb(this.parseGFA(gfaSample));
  }

  parseGFA(content: string): GFAData {
    const lines = content.split(/\n/);
    let GFAdata: GFAData = {
      segments: [],
      links: [],
      jumps: [],
      containments: [],
      paths: [],
    };

    let lineCount = 0;
    lines.forEach((line) => {
      lineCount++;
      if (!line) {
        console.log("Line " + lineCount + " is empty");
      } else if (line[0] === "S") {
        GFAdata.segments.push(this.createSegmentFromGFA(line));
      } else if (line[0] === "L") {
        GFAdata.links.push(this.createLinkFromGFA(line));
      } else if (line[0] === "J") {
        GFAdata.jumps.push(this.createJumpFromGFA(line));
      } else if (line[0] === "C") {
        GFAdata.containments.push(this.createContainmentFromGFA(line));
      } else if (line[0] === "P") {
        if (line[2].indexOf(";") === -1) {
          GFAdata.paths.push(this.createPathFromGFA(line));
        } else {
          console.log("Path v1.2 is not implemented in line " + lineCount);
        }
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
    return GFAdata;
  }
}
