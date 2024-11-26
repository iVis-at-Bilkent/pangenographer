import { Subject } from "rxjs";
import {
  object2TableRow,
  TableData,
  TableViewInput,
  translateColumnNamesAndProperties,
} from "src/app/shared/table-view/table-view-types";
import { GFA_SEGMENT_PROPERTIES_NOT_TO_SHOW } from "src/app/visuall/constants";
import {
  GFASegment,
  TableResponse,
} from "src/app/visuall/db-service/data-types";

// This function is called when the table is filled with data
export function fillTable(
  tableResponse: TableResponse,
  tableInput: TableViewInput,
  tableIsFilled: Subject<boolean>
) {
  tableIsFilled.next(false); // Notify that the table is not filled
  tableInput.results = [];
  tableInput.columns = [];
  let segmentNameMap: { [key: string]: boolean } = {}; // To keep track of unique segment names
  let segmentNameMapSize = 0; // To keep track of unique segment names

  // Iterate over the data to set up the column names
  for (let i = 0; i < tableResponse.data.length; i++) {
    const segment = tableResponse.data[i] as unknown as GFASegment;
    const keys: string[] = Object.keys(segment);
    for (let j = 0; j < keys.length; j++) {
      if (tableInput.columns.indexOf(keys[j]) === -1) {
        tableInput.columns.push(keys[j]);
      }
    }
  }

  // Remove properties that are not to be shown
  tableInput.columns = tableInput.columns.filter(
    (x) => !GFA_SEGMENT_PROPERTIES_NOT_TO_SHOW.includes(x)
  );

  tableInput.columns.sort(); // Sort the column names

  // Move the segment data to the third column
  tableInput.columns = tableInput.columns.filter((x) => x !== "segmentData");
  tableInput.columns.unshift("segmentData");
  // Move the segment length to the second column
  tableInput.columns = tableInput.columns.filter((x) => x !== "segmentLength");
  tableInput.columns.unshift("segmentLength");
  // Move the segment name to the first column
  tableInput.columns = tableInput.columns.filter((x) => x !== "segmentName");
  tableInput.columns.unshift("segmentName");

  // Translate the column names to a more readable format
  tableInput.columns = translateColumnNamesAndProperties(tableInput.columns);

  // Iterate over the data to fill the table
  for (let i = 0; i < tableResponse.data.length; i++) {
    const segment = tableResponse.data[i] as unknown as GFASegment;

    // Check if the segment name is already in the map
    if (segment.segmentName in segmentNameMap) {
      continue;
    }

    // If not, add it to the map
    segmentNameMap[segment.segmentName] = true;
    segmentNameMapSize++;

    // Create a row for the table
    const row: TableData[] = object2TableRow(segment, tableInput.columns, i);

    tableInput.results.push(row); // Add the row to the table
  }

  tableInput.resultCount = tableInput.results.length; // Set the result count
  tableIsFilled.next(true); // Notify that the table is filled
}

// Common function to prepare the input for queries
export function prepareInput(input: string): string {
  let result =
    "'" +
    input
      .replace(/ /g, "")
      .split(/[\n,]/)
      .filter((x) => x)
      .join("','") +
    "'";
  return result;
}
