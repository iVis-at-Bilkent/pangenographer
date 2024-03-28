export enum TableDataType {
  string = 0,
  number = 1,
  enum = 3,
  data = 4,
}

export interface TableData {
  val: any;
  type: TableDataType;
}

export interface TableViewInput {
  // first property of every result must be ID
  results: TableData[][];
  columns: string[];
  isLoadGraph: boolean;
  isMergeGraph: boolean;
  currPage: number;
  pageSize: number;
  resultCnt: number;
  isNodeData: boolean;
  isShowExportAsCSV: boolean;
  columnLimit?: number;
  isHide0?: boolean;
  isUseCySelector4Highlight?: boolean;
  isHideLoadGraph?: boolean;
  isReplace_inHeaders?: boolean;
  isDisableHover?: boolean;
  tableTitle?: string;
  isEmphasizeOnHover?: boolean;
  classNameOfObjects?: string;
  classNames?: string[];
  isBlastResultTable?: boolean;
  allChecked?: boolean;
}

export interface TableFiltering {
  txt: string;
  orderBy: string;
  orderDirection: "asc" | "desc" | "";
  skip?: number;
}

export interface TableRowMeta {
  dbIds: string[];
  tableIdx: number[];
}

export function property2TableData(
  properties: any,
  enumMapping: any,
  propName: string,
  propVal: any,
  className: string,
  isEdge: boolean
): TableData {
  let type = "";

  if (isEdge) {
    type = properties.edges[className][propName];
  } else {
    type = properties.nodes[className][propName];
  }

  if (type === undefined || type == null) {
    return { val: propVal, type: TableDataType.string };
  } else if (type.startsWith("enum")) {
    const mapping = enumMapping[className][propName][propVal];
    if (mapping) {
      return { val: mapping, type: TableDataType.enum };
    }
    return { val: propVal, type: TableDataType.string };
  } else if (type == "string") {
    if (propName === "segmentData") {
      return { val: propVal, type: TableDataType.data };
    } else {
      return { val: propVal, type: TableDataType.string };
    }
  } else if (type == "list") {
    if (typeof propVal === "string") {
      return { val: propVal, type: TableDataType.string };
    }
    return { val: propVal.join(), type: TableDataType.string };
  } else if (type == "float" || type == "int") {
    return { val: propVal, type: TableDataType.number };
  } else {
    return {
      val: "see rawData2TableData function",
      type: TableDataType.string,
    };
  }
}

export function getClassNameFromProperties(
  properties: any,
  propNames: string[]
): string {
  for (let nodeClass in properties.nodes) {
    if (isSubset(Object.keys(properties.nodes[nodeClass]), propNames)) {
      return nodeClass;
    }
  }

  for (let edgeClass in properties.edges) {
    if (isSubset(Object.keys(properties.edges[edgeClass]), propNames)) {
      return edgeClass;
    }
  }
  console.log("could not find class from");
  return null;
}

export function filterTableDatas(
  filter: TableFiltering,
  inp: TableViewInput,
  isIgnoreCaseInText: boolean
) {
  let idxHide = [];
  // filter by text
  for (let i = 0; i < inp.results.length; i++) {
    let isMatch = false;
    // first column is ID
    for (let j = 1; j < inp.results[i].length; j++) {
      let curr = inp.results[i][j].val;
      if (isIgnoreCaseInText) {
        if ((curr + "").toLowerCase().includes(filter.txt.toLowerCase())) {
          isMatch = true;
          break;
        }
      } else {
        if ((curr + "").includes(filter.txt)) {
          isMatch = true;
          break;
        }
      }
    }
    if (!isMatch) {
      idxHide.push(i);
    }
  }

  inp.results = inp.results.filter((_, i) => !idxHide.includes(i));

  // order by
  if (filter.orderDirection.length > 0) {
    let i = inp.columns.findIndex((x) => x == filter.orderBy);
    if (i < 0) {
      console.error("i < 0 !");
    }
    i++; // first column is for ID or for highlight
    if (filter.orderDirection == "asc") {
      inp.results = inp.results.sort((a, b) => {
        if (a[i].val > b[i].val) return 1;
        if (b[i].val > a[i].val) return -1;
        return 0;
      });
    } else {
      inp.results = inp.results.sort((a, b) => {
        if (a[i].val < b[i].val) return 1;
        if (b[i].val < a[i].val) return -1;
        return 0;
      });
    }
  }
  let skip = filter.skip ?? 0;
  if (filter.txt.length > 0) {
    inp.resultCnt = inp.results.length;
  }
  inp.results = inp.results.slice(skip, skip + inp.pageSize);
}

/** check whether a2 is a subset of a1.
 * @param  {} a1 is an array
 * @param  {} a2 is an array
 */
export function isSubset(a1, a2) {
  let superSet = {};
  for (let i = 0; i < a1.length; i++) {
    const e = a1[i] + typeof a1[i];
    superSet[e] = true;
  }

  for (let i = 0; i < a2.length; i++) {
    const e = a2[i] + typeof a2[i];
    if (!superSet[e]) {
      return false;
    }
  }
  return true;
}
