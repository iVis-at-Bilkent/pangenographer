import { TableFiltering } from "../../shared/table-view/table-view-types";

export function getQueryCondition4TxtFilter(
  filter: TableFiltering,
  cols: string[],
  isIgnoreCase: boolean
): string {
  if (filter == null || filter.txt.length < 1) {
    return "";
  }
  let s = "";

  for (let i = 0; i < cols.length; i++) {
    if (isIgnoreCase) {
      s += ` LOWER(toString(${cols[i]})) CONTAINS LOWER('${filter.txt}') OR `;
    } else {
      s += ` toString(${cols[i]}) CONTAINS '${filter.txt}' OR `;
    }
  }
  s = s.slice(0, -3);
  s = "AND (" + s + ")";
  return s;
}

export function getOrderByExpression4Query(
  filter: TableFiltering,
  orderBy: string,
  orderDirection: string,
  ui2Db: any
) {
  if (
    filter != null &&
    filter.orderDirection.length > 0 &&
    filter.orderBy.length > 0
  ) {
    orderBy = ui2Db[filter.orderBy];
    orderDirection = filter.orderDirection;
  }
  return orderBy + " " + orderDirection;
}

export function buildIdFilter(
  ids: string[] | number[],
  hasEnd = false,
  isEdgeQuery = false
): string {
  if (ids === undefined) {
    return "";
  }
  let varName = "n";
  if (isEdgeQuery) {
    varName = "e";
  }
  let cql = "";
  if (ids.length > 0) {
    cql = "(";
  }
  for (let i = 0; i < ids.length; i++) {
    cql += `ElementId(${varName})='${ids[i]}' OR `;
  }

  if (ids.length > 0) {
    cql = cql.slice(0, -4);

    cql += ")";
    if (hasEnd) {
      cql += " AND ";
    }
  }
  return cql;
}
