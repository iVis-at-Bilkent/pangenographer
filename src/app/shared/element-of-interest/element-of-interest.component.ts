import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FileReaderService } from "src/app/visuall/file-reader.service";
import { isJson } from "../../visuall/constants";
import {
  ElementAsQueryParam,
  GraphElement,
} from "../../visuall/db-service/data-types";
import { GlobalVariableService } from "../../visuall/global-variable.service";

@Component({
  selector: "app-element-of-interest",
  templateUrl: "./element-of-interest.component.html",
  styleUrls: ["./element-of-interest.component.css"],
})
export class ElementOfInterestComponent implements OnInit {
  @Input() header: string;
  @Input() typeScope: string[];
  @ViewChild("file", { static: false }) file: any;
  @Output() selectedElementsChanged = new EventEmitter<ElementAsQueryParam[]>();

  selectedNodes: ElementAsQueryParam[] = [];
  clickedNodeIndex = -1;
  addNodeButonTxt = "Select nodes to add";
  addNodeButonImage = "assets/img/add-selection-cursor.svg";
  isShow = true;

  constructor(
    private _g: GlobalVariableService,
    private _fileReaderService: FileReaderService
  ) {}

  ngOnInit(): void {}

  selectedNodeClicked(i: number) {
    this._g.isSwitch2ObjectTabOnSelect = false;
    this.clickedNodeIndex = i;
    const idSelector = "n" + this.selectedNodes[i].dbId;
    this._g.cy.$().unselect();
    this._g.cy.elements(`[id = "${idSelector}"]`).select();
    this._g.isSwitch2ObjectTabOnSelect = true;
  }

  addSelectedNodes() {
    if (this._g.isSwitch2ObjectTabOnSelect) {
      this._g.isSwitch2ObjectTabOnSelect = false;
      this.addNodeButonTxt = "Complete selection";
      this.addNodeButonImage = "assets/img/tick.svg";
      return;
    }
    this.addNodeButonTxt = "Select nodes to add";
    this.addNodeButonImage = "assets/img/add-selection-cursor.svg";
    this._g.isSwitch2ObjectTabOnSelect = true;
    const selectedNodes = this._g.cy.nodes(":selected");
    if (selectedNodes.length < 1) {
      return;
    }
    const dbIds = selectedNodes.map((x: any) => x.id().slice(1));
    const labels = this._g.getLabels4ElementsAsArray(dbIds);
    const types = selectedNodes.map((x: any) => x.classes()[0]);
    for (let i = 0; i < labels.length; i++) {
      if (
        this.selectedNodes.findIndex((x) => x.dbId == dbIds[i]) < 0 &&
        this.isValidType(types[i])
      ) {
        this.selectedNodes.push({
          dbId: dbIds[i],
          label: types[i] + ":" + labels[i],
        });
      }
    }
    this.selectedElementsChanged.next(this.selectedNodes);
  }

  addSelectedNodesFromFile() {
    this.file.nativeElement.value = "";
    this.file.nativeElement.click();
  }

  fileSelected() {
    this._fileReaderService.readTxtFile(
      this.file.nativeElement.files[0],
      (txt) => {
        let elements: GraphElement[] = [];
        if (!isJson(txt)) {
          const arr = txt.split("\n").map((x) => x.split("|"));
          if (arr.length < 0) {
            return;
          }
          const idx4id = arr[0].indexOf("id");

          for (let i = 1; i < arr.length; i++) {
            if (
              this.selectedNodes.find(
                (x) => x.dbId == arr[i][idx4id].substring(1)
              )
            ) {
              continue;
            }
            const o = {};
            for (let j = 1; j < arr[0].length; j++) {
              o[arr[0][j]] = arr[i][j];
            }
            elements.push({ classes: arr[i][0], data: o });
          }
        } else {
          elements = JSON.parse(txt) as GraphElement[];
          const fn1 = (x: any) =>
            this.selectedNodes.find(
              (y) => y.dbId === x.data.id.substring(1)
            ) === undefined;
          if (!(elements instanceof Array)) {
            elements = (JSON.parse(txt).nodes as any[]).filter(fn1);
          } else {
            elements = elements.filter(
              (x: any) => x.data.id.startsWith("n") && fn1(x)
            );
          }
        }

        elements = elements.filter((x) =>
          this.isValidType(x.classes.split(" ")[0])
        );
        const labels = this._g.getLabels4ElementsAsArray(null, true, elements);
        this.selectedNodes = this.selectedNodes.concat(
          elements.map((x, i) => {
            return {
              dbId: x.data.id.substring(1),
              label: x.classes.split(" ")[0] + ":" + labels[i],
            };
          })
        );

        this.selectedElementsChanged.next(this.selectedNodes);
      }
    );
  }

  removeSelected(i: number) {
    if (i == this.clickedNodeIndex) {
      this.clickedNodeIndex = -1;
      const idSelector = "#n" + this.selectedNodes[i].dbId;
      this._g.cy.$(idSelector).unselect();
    } else if (i < this.clickedNodeIndex) {
      this.clickedNodeIndex--;
    }
    this.selectedNodes.splice(i, 1);
    this.selectedElementsChanged.next(this.selectedNodes);
  }

  removeAllSelectedNodes() {
    this.selectedNodes = [];
    this.clickedNodeIndex = -1;
    this.selectedElementsChanged.next(this.selectedNodes);
  }

  private isValidType(className: string): boolean {
    if (!this.typeScope) {
      return true;
    }
    return this.typeScope.includes(className);
  }
}
