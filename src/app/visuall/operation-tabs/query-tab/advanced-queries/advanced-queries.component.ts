import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { GlobalVariableService } from '../../../global-variable.service';
import { DbAdapterService } from '../../../db-service/db-adapter.service';
import { CytoscapeService } from '../../../cytoscape.service';
import { TableViewInput, property2TableData, TableData, TableDataType, TableFiltering, TableRowMeta } from '../../../../shared/table-view/table-view-types';
import { Subject, Subscription } from 'rxjs';
import { Neo4jEdgeDirection, GraphElem, ElemAsQueryParam, DbResponseType } from '../../../db-service/data-types';
import { getCyStyleFromColorAndWid, isJson } from '../../../constants';
import { FileReaderService } from 'src/app/visuall/file-reader.service';

@Component({
  selector: 'app-advanced-queries',
  templateUrl: './advanced-queries.component.html',
  styleUrls: ['./advanced-queries.component.css']
})
export class AdvancedQueriesComponent implements OnInit, OnDestroy {
  @ViewChild('file', { static: false }) file;
  queries: string[];
  selectedQuery: string;
  selectedIdx: number;
  nodeEdgeClasses: string[] = [];
  ignoredTypes: string[] = [];
  lengthLimit = 2;
  isDirected = true;
  selectedNodes: ElemAsQueryParam[] = [];
  selectedClass = '';
  targetOrRegulator = 0;
  clickedNodeIdx = -1;
  addNodeBtnTxt = 'Select Nodes to Add';
  tableInput: TableViewInput = {
    columns: ['Title'], results: [], isEmphasizeOnHover: true, tableTitle: 'Query Results', isShowExportAsCSV: true,
    resultCnt: 0, currPage: 1, pageSize: 0, isLoadGraph: false, isMergeGraph: true, isNodeData: true
  };
  tableFilter: TableFiltering = { orderBy: null, orderDirection: null, txt: '', skip: null };
  tableFilled = new Subject<boolean>();
  dataPageSizeSubs: Subscription;
  dataModelSubs: Subscription;
  dbResponse = null;

  constructor(private _g: GlobalVariableService, private _dbService: DbAdapterService, private _cyService: CytoscapeService, private _fileReaderService: FileReaderService) {
    this.queries = ['Get neighborhood', 'Get graph of interest', 'Get common targets/regulators'];
    this.selectedIdx = -1;
  }

  ngOnInit(): void {
    this.dataModelSubs = this._g.dataModel.subscribe(x => {
      if (x) {
        for (const n in x.nodes) {
          this.nodeEdgeClasses.push(n);
        }
        for (const e in x.edges) {
          this.nodeEdgeClasses.push(e);
        }
      }
    });
    this.selectedQuery = '';
    this.dataPageSizeSubs = this._g.userPrefs.dataPageSize.subscribe(x => { this.tableInput.pageSize = x; this.tableInput.currPage = 1; this.tableFilter.skip = 0; });
  }

  ngOnDestroy(): void {
    if (this.dataModelSubs) {
      this.dataModelSubs.unsubscribe();
    }
    if (this.dataPageSizeSubs) {
      this.dataPageSizeSubs.unsubscribe();
    }
  }

  changeAdvancedQuery(event) {
    this.selectedIdx = this.queries.findIndex(x => x == event.target.value);
  }

  addSelectedNodes() {
    if (this._g.isSwitch2ObjTabOnSelect) {
      this._g.isSwitch2ObjTabOnSelect = false;
      this.addNodeBtnTxt = 'Complete Selection';
      return;
    }
    this.addNodeBtnTxt = 'Select Nodes to Add';
    this._g.isSwitch2ObjTabOnSelect = true;
    const selectedNodes = this._g.cy.nodes(':selected');
    if (selectedNodes.length < 1) {
      return;
    }
    const dbIds = selectedNodes.map(x => x.id().slice(1));
    const labels = this._g.getLabels4ElemsAsArray(dbIds);
    const types = selectedNodes.map(x => x.classes()[0]);
    for (let i = 0; i < labels.length; i++) {
      if (this.selectedNodes.findIndex(x => x.dbId == dbIds[i]) < 0) {
        this.selectedNodes.push({ dbId: dbIds[i], label: types[i] + ':' + labels[i] });
      }
    }
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
  }

  removeAllSelectedNodes() {
    this.selectedNodes = [];
    this.clickedNodeIdx = -1;
  }

  runQuery(isFromFilter: boolean, idFilter: (string | number)[] | null) {
    if (!isFromFilter && !idFilter) {
      this.tableFilter.skip = 0;
      this.tableInput.currPage = 1;
    }
    const dbIds = this.selectedNodes.map(x => x.dbId);
    if (dbIds.length < 1) {
      return;
    }
    const isClientSidePagination = this._g.userPrefs.queryResultPagination.getValue() == 'Client';
    const prepareDataFn = (x) => {
      if (!idFilter && !isFromFilter) {
        this.dbResponse = x;
      }

      if (!idFilter) {
        if (isClientSidePagination) {
          const clientSideX = this.filterDbResponse(x, isFromFilter ? this.tableFilter : null, idFilter);
          this.fillTable(clientSideX, !isFromFilter, isClientSidePagination);
        } else {
          this.fillTable(x, !isFromFilter, isClientSidePagination);
        }
      }
      if (this.tableInput.isLoadGraph || idFilter) {
        if (isClientSidePagination) {
          const clientSideX = this.filterDbResponse(x, isFromFilter ? this.tableFilter : null, idFilter);
          this._cyService.loadElementsFromDatabase(this.prepareElems4Cy(clientSideX), this.tableInput.isMergeGraph);
        } else {
          this._cyService.loadElementsFromDatabase(this.prepareElems4Cy(x), this.tableInput.isMergeGraph);
        }
        this.highlightSeedNodes();
        this.highlightTargetRegulators(x);
      }
    };
    if (isFromFilter && isClientSidePagination) {
      prepareDataFn(this.dbResponse);
    } else {
      const types = this.ignoredTypes.map(x => `'${x}'`);
      if (this.selectedIdx == 1) {
        this._dbService.getGraphOfInterest(dbIds, types, this.lengthLimit, this.isDirected, DbResponseType.table, this.tableFilter, idFilter, prepareDataFn);
      } else if (this.selectedIdx == 2) {
        let dir: Neo4jEdgeDirection = this.targetOrRegulator;
        if (!this.isDirected) {
          dir = Neo4jEdgeDirection.BOTH;
        }
        this._dbService.getCommonStream(dbIds, types, this.lengthLimit, dir, DbResponseType.table, this.tableFilter, idFilter, prepareDataFn);
      } else if (this.selectedIdx == 0) {
        this._dbService.getNeighborhood(dbIds, types, this.lengthLimit, this.isDirected, this.tableFilter, idFilter, prepareDataFn);
      }
    }

  }

  setSelected(x: ElemAsQueryParam[]) {
    this.selectedNodes = x;
  }

  // used for client-side filtering
  private filterDbResponse(x, filter: TableFiltering, idFilter: (string | number)[]) {
    const r = { columns: x.columns, data: [[null, null, null, null, null, null, null, null]] };
    const idxNodes = x.columns.indexOf('nodes');
    const idxNodeId = x.columns.indexOf('nodeId');
    const idxNodeClass = x.columns.indexOf('nodeClass');
    const idxEdges = x.columns.indexOf('edges');
    const idxEdgeId = x.columns.indexOf('edgeId');
    const idxEdgeClass = x.columns.indexOf('edgeClass');
    const idxEdgeSrcTgt = x.columns.indexOf('edgeSourceTargets');
    const idxTotalCnt = x.columns.indexOf('totalNodeCount');
    const maxResultCnt = this._g.userPrefs.dataPageLimit.getValue() * this._g.userPrefs.dataPageSize.getValue();

    const nodes = x.data[0][idxNodes];
    const nodeClass = x.data[0][idxNodeClass];
    const nodeId = x.data[0][idxNodeId];
    const edges = x.data[0][idxEdges];
    const edgeClass = x.data[0][idxEdgeClass];
    const edgeId = x.data[0][idxEdgeId];
    const edgeSrcTgt = x.data[0][idxEdgeSrcTgt];
    r.data[0][idxEdges] = edges;
    r.data[0][idxEdgeClass] = edgeClass;
    r.data[0][idxEdgeId] = edgeId;
    r.data[0][idxEdgeSrcTgt] = edgeSrcTgt;
    r.data[0][idxTotalCnt] = x.data[0][idxTotalCnt] > maxResultCnt ? maxResultCnt : x.data[0][idxTotalCnt];

    const isIgnoreCase = this._g.userPrefs.isIgnoreCaseInText.getValue();

    let tempNodes: { node: any, cls: string, id: string | number }[] = [];
    const srcNodeIds = this.selectedNodes.map(x => x.dbId);
    if (idFilter) {
      tempNodes = nodes.map((_, i) => { return { node: nodes[i], cls: nodeClass[i], id: nodeId[i] } })
        .filter((_, i) => { return idFilter.includes(nodeId[i]) || srcNodeIds.findIndex(x => x == nodeId[i]) > -1; });
    }
    else if (filter) {
      for (let i = 0; i < nodes.length; i++) {
        const vals = Object.values(nodes[i]).join('');
        // always include source nodes
        if (srcNodeIds.includes(nodeId[i]) || (isIgnoreCase && vals.toLowerCase().includes(filter.txt.toLowerCase())) || (!isIgnoreCase && vals.includes(filter.txt))) {
          tempNodes.push({ node: nodes[i], cls: nodeClass[i], id: nodeId[i] });
        }
      }
    } else {
      tempNodes = nodes.map((_, i) => { return { node: nodes[i], cls: nodeClass[i], id: nodeId[i] } })
    }

    // order by
    if (!idFilter && filter && filter.orderDirection.length > 0) {
      const o = filter.orderBy;
      if (filter.orderDirection == 'asc') {
        tempNodes = tempNodes.sort((a, b) => { if (!a.node[o]) return 1; if (!b.node[o]) return -1; if (a.node[o] > b.node[o]) return 1; if (b.node[o] > a.node[o]) return -1; return 0 });
      } else {
        tempNodes = tempNodes.sort((a, b) => { if (!a.node[o]) return 1; if (!b.node[o]) return -1; if (a.node[o] < b.node[o]) return 1; if (b.node[o] < a.node[o]) return -1; return 0 });
      }
    }
    const skip = filter && filter.skip ? filter.skip : 0;
    for (let i = 0; i < srcNodeIds.length; i++) {
      const idx = tempNodes.findIndex(x => x.id == srcNodeIds[i]);
      // move src node to the beginning
      if (idx > -1) {
        const tmp = tempNodes[idx];
        tempNodes[idx] = tempNodes[i];
        tempNodes[i] = tmp;
      }
    }
    if (filter && !idFilter) {
      this.tableInput.resultCnt = tempNodes.length;
    }

    tempNodes = tempNodes.slice(skip, skip + this._g.userPrefs.dataPageSize.getValue());
    r.data[0][idxNodes] = tempNodes.map(x => x.node);
    r.data[0][idxNodeClass] = tempNodes.map(x => x.cls);
    r.data[0][idxNodeId] = tempNodes.map(x => x.id);
    return r;
  }

  // fill table from graph response
  private fillTable(data, isRefreshColumns = true, isClientSidePagination = true) {
    const idxNodes = data.columns.indexOf('nodes');
    const idxNodeId = data.columns.indexOf('nodeId');
    const idxNodeClass = data.columns.indexOf('nodeClass');
    const idxTotalCnt = data.columns.indexOf('totalNodeCount');
    const nodes = data.data[0][idxNodes];
    const nodeClass = data.data[0][idxNodeClass];
    const nodeId = data.data[0][idxNodeId];
    if (isRefreshColumns || !isClientSidePagination) {
      this.tableInput.resultCnt = data.data[0][idxTotalCnt];
    }

    this.tableInput.results = [];
    if (isRefreshColumns) {
      this.tableInput.columns = [];
    }
    this.tableInput.classNames = [];
    const enumMapping = this._g.getEnumMapping();
    const props = this._g.dataModel.getValue();
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i];
      delete d['tconst'];
      delete d['nconst'];
      const propNames = Object.keys(d);
      const row: TableData[] = [{ type: TableDataType.string, val: nodeId[i] }];
      for (const n of propNames) {
        const idx = this.tableInput.columns.indexOf(n);
        if (idx == -1) {
          this.tableInput.columns.push(n);
          row[this.tableInput.columns.length] = property2TableData(props, enumMapping, n, d[n], nodeClass[i], false);
        } else {
          row[idx + 1] = property2TableData(props, enumMapping, n, d[n], nodeClass[i], false);
        }
      }
      // fill empty columns
      for (let j = 0; j < this.tableInput.columns.length + 1; j++) {
        if (!row[j]) {
          row[j] = { val: '', type: TableDataType.string };
        }
      }
      this.tableInput.classNames.push(nodeClass[i]);
      this.tableInput.results.push(row);
    }

    const maxColCnt = Math.max(...this.tableInput.results.map(x => x.length));
    for (let i = 0; i < this.tableInput.results.length; i++) {
      for (let j = this.tableInput.results[i].length; j < maxColCnt; j++) {
        this.tableInput.results[i].push({ val: '', type: TableDataType.string });
      }
    }
    this.tableFilled.next(true);
  }

  private highlightSeedNodes() {
    const dbIds = this.selectedNodes.map(x => x.dbId);
    const seedNodes = this._g.cy.nodes(dbIds.map(x => '#n' + x).join());
    // add a new higlight style
    if (this._g.userPrefs.highlightStyles.length < 2) {
      const cyStyle = getCyStyleFromColorAndWid('#0b9bcd', 4.5);
      this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    }
    const currHighlightIdx = this._g.userPrefs.currHighlightIdx.getValue();
    if (currHighlightIdx == 0) {
      this._g.viewUtils.highlight(seedNodes, 1);
    } else {
      this._g.viewUtils.highlight(seedNodes, 0);
    }
  }

  private highlightTargetRegulators(data) {
    const idxTargetRegulator = data.columns.indexOf('targetRegulatorNodeIds');
    const dbIds = data.data[0][idxTargetRegulator];
    if (!dbIds || dbIds.length < 1) {
      return;
    }
    const cyNodes = this._g.cy.nodes(dbIds.map(x => '#n' + x).join());

    // add a new higlight style
    if (this._g.userPrefs.highlightStyles.length < 3) {
      const cyStyle = getCyStyleFromColorAndWid('#04f06a', 4.5);
      this._g.viewUtils.addHighlightStyle(cyStyle.node, cyStyle.edge);
    }
    this._g.viewUtils.highlight(cyNodes, 2);
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

      const labels = this._g.getLabels4ElemsAsArray(null, true, elems);
      this.selectedNodes = this.selectedNodes.concat(elems.map((x, i) => { return { dbId: x.data.id.substring(1), label: x.classes.split(' ')[0] + ':' + labels[i] } }));
    });
  }

  addRemoveType(e: { className: string, willBeShowed: boolean }) {
    if (e.willBeShowed) {
      const idx = this.ignoredTypes.findIndex(x => x === e.className);
      if (idx > -1) {
        this.ignoredTypes.splice(idx, 1);
      }
    } else {
      if (!this.ignoredTypes.includes(e.className)) {
        this.ignoredTypes.push(e.className);
      }
    }
  }

  selectedNodeClicked(i: number) {
    this._g.isSwitch2ObjTabOnSelect = false;
    this.clickedNodeIdx = i;
    const idSelector = '#n' + this.selectedNodes[i].dbId;
    this._g.cy.$().unselect();
    this._g.cy.$(idSelector).select();
    this._g.isSwitch2ObjTabOnSelect = true;
  }

  getDataForQueryResult(e: TableRowMeta) {
    this.runQuery(true, e.dbIds);
  }

  filterTable(filter: TableFiltering) {
    console.log('filter table: ', filter);
    this.tableFilter = filter;
    this.runQuery(true, null);
  }

  prepareElems4Cy(data) {
    const idxNodes = data.columns.indexOf('nodes');
    const idxNodeId = data.columns.indexOf('nodeId');
    const idxNodeClass = data.columns.indexOf('nodeClass');
    const idxEdges = data.columns.indexOf('edges');
    const idxEdgeId = data.columns.indexOf('edgeId');
    const idxEdgeClass = data.columns.indexOf('edgeClass');
    const idxEdgeSrcTgt = data.columns.indexOf('edgeSourceTargets');

    const nodes = data.data[0][idxNodes];
    const nodeClass = data.data[0][idxNodeClass];
    const nodeId = data.data[0][idxNodeId];
    const edges = data.data[0][idxEdges];
    const edgeClass = data.data[0][idxEdgeClass];
    const edgeId = data.data[0][idxEdgeId];
    const edgeSrcTgt = data.data[0][idxEdgeSrcTgt];

    const cyData = { nodes: [], edges: [] };
    const nodeIdsDict = {};
    for (let i = 0; i < nodes.length; i++) {
      cyData.nodes.push({ id: nodeId[i], labels: [nodeClass[i]], properties: nodes[i] });
      nodeIdsDict[nodeId[i]] = true;
    }

    for (let i = 0; i < edges.length; i++) {
      const srcId = edgeSrcTgt[i][0];
      const tgtId = edgeSrcTgt[i][1];
      // check if src and target exist in cy or current data.
      const isSrcLoaded = this.tableInput.isMergeGraph ? this._g.cy.$('#n' + srcId).length > 0 : false;
      const isTgtLoaded = this.tableInput.isMergeGraph ? this._g.cy.$('#n' + tgtId).length > 0 : false;
      if ((nodeIdsDict[srcId] || isSrcLoaded) && (nodeIdsDict[tgtId] || isTgtLoaded)) {
        cyData.edges.push({ properties: edges[i], startNode: srcId, endNode: tgtId, id: edgeId[i], type: edgeClass[i] });
      }
    }

    return cyData;
  }

}
