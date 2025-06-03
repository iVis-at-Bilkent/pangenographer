export interface TableData {
  value: any;
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
  classNames?: string[];
  isBlastResultTable?: boolean;
  allChecked?: boolean;
  queriedSequences?: string;
  paths?: string[];
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

export function object2TableRow(
  objectProperties: any,
  columnNames: string[],
  id: string
): TableData[] {
  let row: TableData[] = [];

  // first column is id
  row.push({
    value: id,
  });

  for (let i = 0; i < columnNames.length; i++) {
    let objectPropertyName = translateColumnNamesAndProperties(
      columnNames[i]
    )[0];
    let objectPropertyValue = objectProperties[objectPropertyName];

    row.push({
      value: objectPropertyValue,
    });
  }

  return row;
}

export function translateColumnNamesAndProperties(
  names: string[] | string
): string[] {
  if (typeof names === "string") {
    names = [names];
  }

  let labels = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i].charAt(0) >= "A" && names[i].charAt(0) <= "Z") {
      // Lowercase the string
      names[i] = names[i].toLowerCase();
      // Split the string according to spaces
      let split = names[i].split(" ");
      // Capitalize the first letter of each word, except the first one
      for (let j = 1; j < split.length; j++) {
        split[j] = split[j].trim();
        split[j] = split[j].charAt(0).toUpperCase() + split[j].slice(1);
      }
      // Join the split string without spaces
      labels.push(split.join(""));
    } else {
      // Split the string according to capital letters
      let split = names[i].split(/(?=[A-Z])/);
      // Make capital letters lowercase
      for (let j = 0; j < split.length; j++) {
        split[j] = split[j].toLowerCase();
      }
      // Join the split string with spaces
      labels.push(split.join(" "));
      // Capitalize the first letter
      labels[i] = labels[i].charAt(0).toUpperCase() + labels[i].slice(1);
    }
  }

  return labels;
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

export function filterTableData(
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
