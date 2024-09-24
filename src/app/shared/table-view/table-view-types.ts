export enum TableDataType {
  string = 0,
  number = 1,
  enum = 3,
  data = 4, // for segmentData like sequences
}

export interface TableData {
  value: any;
  type: TableDataType;
}

export interface TableViewInput {
  // first property of every result must be ID
  results: TableData[][];
  columns: string[];
  isLoadGraph: boolean;
  isMergeGraph: boolean;
  currentPage: number;
  pageSize: number;
  resultCount: number;
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
  tableIndex: number[];
}

export function property2TableData(
  properties: any,
  enumMapping: any,
  propertyName: string,
  propertyValue: any,
  className: string,
  isEdge: boolean
): TableData {
  let type = undefined;

  if (isEdge) {
    type = properties.edges[className][propertyName];
  } else {
    type = properties.nodes[className][propertyName];
  }

  console.log("type", type);

  if (type === undefined || type == null) {
    return { value: propertyValue, type: TableDataType.string };
  } else if (type.startsWith("enum")) {
    const mapping = enumMapping[className][propertyName][propertyValue];
    if (mapping) {
      return { value: mapping, type: TableDataType.enum };
    }

    return { value: propertyValue, type: TableDataType.string };
  } else if (type == "string") {
    // SegmentData is a special case and considered as data
    if (propertyName === "segmentData") {
      return { value: propertyValue, type: TableDataType.data };
    } else {
      return { value: propertyValue, type: TableDataType.string };
    }
  } else if (type == "list" || type.includes("[]")) {
    if (typeof propertyValue === "string") {
      return { value: propertyValue, type: TableDataType.string };
    }

    return { value: propertyValue.join(), type: TableDataType.string };
  } else if (
    type == "float" ||
    type == "int" ||
    type == "long" ||
    type == "double" ||
    type == "short" ||
    type == "number"
  ) {
    return { value: propertyValue, type: TableDataType.number };
  } else {
    console.log("type not found", type);
    console.log("propertyValue", propertyValue);
    console.log("propertyName", propertyName);
    console.log("className", className);
    console.log("isEdge", isEdge);
    console.log("properties", properties);
    console.log("enumMapping", enumMapping);

    return {
      value: "see rawData2TableData function",
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
  input: TableViewInput,
  isIgnoreCaseInText: boolean
) {
  let indexHide = [];
  // filter by text
  for (let i = 0; i < input.results.length; i++) {
    let isMatch = false;
    // first column is ID
    for (let j = 1; j < input.results[i].length; j++) {
      let curr = input.results[i][j].value;
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
      indexHide.push(i);
    }
  }

  input.results = input.results.filter((_, i) => !indexHide.includes(i));

  // order by
  if (filter.orderDirection.length > 0) {
    let i = input.columns.findIndex((x) => x == filter.orderBy);
    if (i < 0) {
      console.error("i < 0 !");
    }
    i++; // first column is for ID or for highlight
    if (filter.orderDirection == "asc") {
      input.results = input.results.sort((a, b) => {
        if (a[i].value > b[i].value) return 1;
        if (b[i].value > a[i].value) return -1;
        return 0;
      });
    } else {
      input.results = input.results.sort((a, b) => {
        if (a[i].value < b[i].value) return 1;
        if (b[i].value < a[i].value) return -1;
        return 0;
      });
    }
  }
  let skip = filter.skip ?? 0;
  if (filter.txt.length > 0) {
    input.resultCount = input.results.length;
  }
  input.results = input.results.slice(skip, skip + input.pageSize);
}

/** check whether a2 is a subset of a1.
 * @param  {} a1 is an array
 * @param  {} a2 is an array
 */
export function isSubset(a1: any, a2: any) {
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
