import { TableFiltering } from "../../../../shared/table-view/table-view-types";

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
    cql += `ID(${varName})=${ids[i]} OR `;
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
