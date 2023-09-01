import { Component, OnInit, ViewChild, Output, EventEmitter, Input } from '@angular/core';
import { GlobalVariableService } from '../../visuall/global-variable.service';
import { FileReaderService } from 'src/app/visuall/file-reader.service';
import { isJson } from '../../visuall/constants';
import { GraphElem, ElemAsQueryParam } from '../../visuall/db-service/data-types';

@Component({
  selector: 'app-elem-of-interest',
  templateUrl: './elem-of-interest.component.html',
  styleUrls: ['./elem-of-interest.component.css']
})
export class ElemOfInterestComponent implements OnInit {

  @Input() header: string;
  @Input() typeScope: string[];
  @ViewChild('file', { static: false }) file;
  @Output() selectedElemsChanged = new EventEmitter<ElemAsQueryParam[]>();

  selectedNodes: ElemAsQueryParam[] = [];
  clickedNodeIdx = -1;
  addNodeBtnTxt = 'Select nodes to add';
  addNodeBtnImg = 'assets/img/add-selection-cursor.svg';
  isShow = true;
  
  constructor(private _g: GlobalVariableService, private _fileReaderService: FileReaderService) { }

  ngOnInit(): void {
  }

  selectedNodeClicked(i: number) {
    this._g.isSwitch2ObjTabOnSelect = false;
    this.clickedNodeIdx = i;
    const idSelector = '#n' + this.selectedNodes[i].dbId;
    this._g.cy.$().unselect();
    this._g.cy.$(idSelector).select();
    this._g.isSwitch2ObjTabOnSelect = true;
  }

  addSelectedNodes() {
    if (this._g.isSwitch2ObjTabOnSelect) {
      this._g.isSwitch2ObjTabOnSelect = false;
      this.addNodeBtnTxt = 'Complete selection';
      this.addNodeBtnImg = 'assets/img/tick.svg'
      return;
    }
    this.addNodeBtnTxt = 'Select nodes to add';
    this.addNodeBtnImg = 'assets/img/add-selection-cursor.svg'
    this._g.isSwitch2ObjTabOnSelect = true;
    const selectedNodes = this._g.cy.nodes(':selected');
    if (selectedNodes.length < 1) {
      return;
    }
    const dbIds = selectedNodes.map(x => x.id().slice(1));
    const labels = this._g.getLabels4ElemsAsArray(dbIds);
    const types = selectedNodes.map(x => x.classes()[0]);
    for (let i = 0; i < labels.length; i++) {
      if (this.selectedNodes.findIndex(x => x.dbId == dbIds[i]) < 0 && this.isValidType(types[i])) {
        this.selectedNodes.push({ dbId: dbIds[i], label: types[i] + ':' + labels[i] });
      }
    }
    this.selectedElemsChanged.next(this.selectedNodes);
  }

  addSelectedNodesFromFile() {
    this.file.nativeElement.value = '';
    this.file.nativeElement.click();
  }

  fileSelected() {
    this._fileReaderService.readTxtFile(this.file.nativeElement.files[0], (txt) => {
      let elems: GraphElem[] = [];
      if (!isJson(txt)) {
        const arr = txt.split('\n').map(x => x.split('|'));
        if (arr.length < 0) {
          return;
        }
        const idx4id = arr[0].indexOf('id');

        for (let i = 1; i < arr.length; i++) {
          if (this.selectedNodes.find(x => x.dbId == arr[i][idx4id].substring(1))) {
            continue;
          }
          const o = {};
          for (let j = 1; j < arr[0].length; j++) {
            o[arr[0][j]] = arr[i][j];
          }
          elems.push({ classes: arr[i][0], data: o });
        }
      } else {
        elems = JSON.parse(txt) as GraphElem[];
        const fn1 = x => this.selectedNodes.find(y => y.dbId === x.data.id.substring(1)) === undefined;
        if (!(elems instanceof Array)) {
          elems = (JSON.parse(txt).nodes as any[]).filter(fn1);
        } else {
          elems = elems.filter(x => x.data.id.startsWith('n') && fn1(x));
        }
      }

      elems = elems.filter(x => this.isValidType(x.classes.split(' ')[0]));
      const labels = this._g.getLabels4ElemsAsArray(null, true, elems);
      this.selectedNodes = this.selectedNodes.concat(elems.map((x, i) => { return { dbId: x.data.id.substring(1), label: x.classes.split(' ')[0] + ':' + labels[i] } }));

      this.selectedElemsChanged.next(this.selectedNodes);
    });
  }

  removeSelected(i: number) {
    if (i == this.clickedNodeIdx) {
      this.clickedNodeIdx = -1;
      const idSelector = '#n' + this.selectedNodes[i].dbId;
      this._g.cy.$(idSelector).unselect();
    } else if (i < this.clickedNodeIdx) {
      this.clickedNodeIdx--;
    }
    this.selectedNodes.splice(i, 1);
    this.selectedElemsChanged.next(this.selectedNodes);
  }

  removeAllSelectedNodes() {
    this.selectedNodes = [];
    this.clickedNodeIdx = -1;
    this.selectedElemsChanged.next(this.selectedNodes);
  }

  private isValidType(className: string): boolean {
    if (!this.typeScope) {
      return true;
    }
    return this.typeScope.includes(className);
  }

}
