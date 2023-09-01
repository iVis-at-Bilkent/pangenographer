import { Injectable, NgZone } from "@angular/core";
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

  createSegmentFromGFA(segmentLine: string) {
    var segment = {
      data: {
        segmentData: "",
        segmentName: "",
        segmentLength: 0,
        id: "",
      },
      position: { x: 0, y: 0 },
      group: "nodes",
      removed: false,
      selected: false,
      selectable: true,
      locked: false,
      grabbable: true,
      pannable: false,
      classes: "Segment",
    };
    var segmentLineTabSeperated = segmentLine
      .substring(0, segmentLine.length - 1)
      .split(/\t/);
    segment.data.segmentName = segmentLineTabSeperated[1];
    segment.data.id = segmentLineTabSeperated[1];
    segment.data.segmentData = segmentLineTabSeperated[2];
    segment.data.segmentLength = segmentLineTabSeperated[2].length;
    for (let i = 3; i < segmentLineTabSeperated.length; i++) {
      var optField = (segmentLineTabSeperated[i] as string).trim();
      if (optField.startsWith("LN")) {
        segment["data"]["segmentLength"] = Number(optField.substring(5));
      } else if (optField.startsWith("RC")) {
        segment["data"]["readCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("FC")) {
        segment["data"]["fragmentCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("KC")) {
        segment["data"]["kmerCount"] = Number(optField.substring(5));
      } else if (optField.startsWith("SH")) {
        segment["data"]["SHA256Checksum"] = optField;
      } else if (optField.startsWith("UR")) {
        segment["data"]["URIorLocalSystemPath"] = optField;
      } else {
        console.log("This field is not parsed: " + optField);
      }
    }

    return segment;
  }

  createLinkFromGFA(linkLine: string) {
    var link = {
      data: {},
      position: { x: 0, y: 0 },
      group: "edges",
      removed: false,
      selected: false,
      selectable: true,
      locked: false,
      grabbable: true,
      pannable: true,
    };
    var linkLineTabSeperated = linkLine.split(/\t/);
    if (linkLineTabSeperated[0] === "L") {
      link["data"]["source"] = linkLineTabSeperated[1];
      link["data"]["sourceOrientation"] = linkLineTabSeperated[2];
      link["data"]["target"] = linkLineTabSeperated[3];
      link["data"]["targetOrientation"] = linkLineTabSeperated[4];

      for (let i = 4; i < linkLineTabSeperated.length; i++) {
        var optField = (linkLineTabSeperated[i] as string).trim();
        if (optField.startsWith("MQ")) {
          link["data"]["mappingQuality"] = Number(optField.substring(5));
        } else if (optField.startsWith("NM")) {
          link["data"]["numberOfMismatchesOrGaps"] = Number(
            optField.substring(5)
          );
        } else if (optField.startsWith("RC")) {
          link["data"]["readCount"] = Number(optField.substring(5));
        } else if (optField.startsWith("FC")) {
          link["data"]["fragmentCount"] = Number(optField.substring(5));
        } else if (optField.startsWith("KC")) {
          link["data"]["kmerCount"] = Number(optField.substring(5));
        } else if (optField.startsWith("ID")) {
          link["data"]["edgeIdentifier"] = optField;
        } else {
          link["data"]["overlap"] = optField;
        }
      }
      link["classes"] = "LINK";
    } else if (linkLineTabSeperated[0] === "J") {
      link["data"]["source"] = linkLineTabSeperated[1];
      link["data"]["sourceOrientation"] = linkLineTabSeperated[2];
      link["data"]["target"] = linkLineTabSeperated[3];
      link["data"]["targetOrientation"] = linkLineTabSeperated[4];

      for (let i = 4; i < linkLineTabSeperated.length; i++) {
        var optField = (linkLineTabSeperated[i] as string).trim();
        if (optField.startsWith("SC")) {
          link["data"]["indirectShortcutConnections"] = Number(
            optField.substring(5)
          );
        } else {
          link["data"]["distance"] = optField;
        }
      }
      link["classes"] = "JUMP";
    } else if (linkLineTabSeperated[0] === "C") {
      link["data"]["source"] = linkLineTabSeperated[1];
      link["data"]["sourceOrientation"] = linkLineTabSeperated[2];
      link["data"]["target"] = linkLineTabSeperated[3];
      link["data"]["targetOrientation"] = linkLineTabSeperated[4];
      link["data"]["pos"] = Number(linkLineTabSeperated[5]);
      link["data"]["overlap"] = linkLineTabSeperated[6];

      for (let i = 4; i < linkLineTabSeperated.length; i++) {
        var optField = (linkLineTabSeperated[i] as string).trim();
        if (optField.startsWith("RC")) {
          link["data"]["readCount"] = Number(optField.substring(5));
        } else if (optField.startsWith("NM")) {
          link["data"]["numberOfMismatchesOrGaps"] = Number(
            optField.substring(5)
          );
        } else if (optField.startsWith("ID")) {
          link["data"]["edgeIdentifier"] = optField;
        }
      }
      link["classes"] = "CONTAINMENT";
    }

    return link;
  }

  readGFAFile(gfaFile: File, cb: (any) => void) {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        const lines = (fileContent as string).split(/\n/);
        const GFAdata = {
          nodes: [],
          edges: [],
        };

        let lineCount = 0;

        lines.forEach((line) => {
          lineCount++;
          if (!line) {
            console.log("Line " + lineCount + " is empty");
          } else if (line[0] === "S") {
            GFAdata.nodes.push(this.createSegmentFromGFA(line));
          } else if (line[0].match(/(L|C|J)/)) {
            GFAdata.edges.push(this.createLinkFromGFA(line));
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

        cb(GFAdata);
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

  readGFA2File(gfaFile: File, cb: (any) => void) {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        const lines = (fileContent as string).split(/\n/);
        const GFAdata = {
          nodes: [],
          edges: [],
        };

        let lineCount = 0;

        lines.forEach((line) => {
          lineCount++;
          if (!line) {
            console.log("Line " + lineCount + " is empty");
          } else if (line[0] === "S") {
            GFAdata.nodes.push(this.createSegmentFromGFA(line));
          } else if (line[0].match(/(L|C|J)/)) {
            GFAdata.edges.push(this.createLinkFromGFA(line));
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

        cb(GFAdata);
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
}
