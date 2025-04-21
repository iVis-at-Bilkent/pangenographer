import {
  COLLAPSED_EDGE_CLASS,
  GENERIC_TYPE,
  NEO4J_2_JS_NUMBER_OPERATORS,
  NEO4J_2_JS_STR_OPERATORS,
} from "../../constants";

export interface QueryRule {
  name: string;
  rules: ClassBasedRules;
  isEditing: boolean;
  isOnDb: boolean;
  isLoadGraph: boolean;
  isMergeGraph: boolean;
}

export interface ClassOption {
  text: string;
  isDisabled: boolean;
}

export interface ClassBasedRules {
  className: string;
  rules: RuleNode;
  isEdge: boolean;
}

export interface RuleNode {
  r: Rule;
  children: RuleNode[];
  parent: RuleNode;
  isEditing?: boolean;
}

export function deepCopyRuleNode(root: RuleNode): RuleNode {
  if (!root) {
    return null;
  }
  const r: RuleNode = { r: root.r, children: [], parent: root.parent };
  for (const child of root.children) {
    r.children.push(deepCopyRuleNode(child));
  }
  return r;
}

export function deepCopyQueryRule(m: QueryRule): QueryRule {
  let r: RuleNode = deepCopyRuleNode(m.rules.rules);
  let rules: ClassBasedRules = {
    className: m.rules.className,
    isEdge: m.rules.isEdge,
    rules: r,
  };
  return {
    isEditing: m.isEditing,
    isLoadGraph: m.isLoadGraph,
    isMergeGraph: m.isMergeGraph,
    isOnDb: m.isOnDb,
    name: m.name,
    rules: rules,
  };
}

export function deepCopyQueryRules(metrics: QueryRule[]): QueryRule[] {
  let t2: QueryRule[] = [];
  for (const m of metrics) {
    t2.push(deepCopyQueryRule(m));
  }
  return t2;
}

export interface Rule {
  propertyOperand?: string;
  propertyType?: string;
  operator?: string;
  inputOperand?: string;
  ruleOperator: "AND" | "OR" | null;
  rawInput?: string;
}

export interface RuleSync {
  properties: string[];
  isGenericTypeSelected: boolean;
  selectedClass: string;
}

export function isSumRule(r: Rule): boolean {
  return (
    r &&
    !r.operator &&
    (r.propertyType == "int" ||
      r.propertyType == "float" ||
      r.propertyType == "edge")
  );
}

export function getBoolExpressionFromMetric(m: ClassBasedRules): string {
  let classCondition = "";
  // apply class condition
  if (m.className.toLowerCase() == GENERIC_TYPE.EDGES_CLASS.toLowerCase()) {
    classCondition = ` x.isEdge() `;
  } else if (
    m.className.toLowerCase() == GENERIC_TYPE.NODES_CLASS.toLowerCase()
  ) {
    classCondition = ` x.isNode() `;
  } else if (
    m.className.toLowerCase() == GENERIC_TYPE.ANY_CLASS.toLowerCase()
  ) {
    classCondition = ` true `;
  } else {
    classCondition = ` x.classes().map(x => x.toLowerCase()).includes('${m.className.toLowerCase()}') `;
  }

  const isAgg = m.rules.r && isSumRule(m.rules.r);
  const propertyCondition = getBoolExpressionFromRuleNode(m.rules, isAgg);

  if (propertyCondition.length < 1) {
    return `if (${classCondition})`;
  }
  return `if ( (${classCondition}) && (${propertyCondition}))`;
}

function getBoolExpressionFromRuleNode(node: RuleNode, isAgg: boolean) {
  let s = "(";
  if (!isAgg && (!node.r || !node.r.ruleOperator)) {
    if (!node.r || !node.r.propertyType) {
      s += "true";
    } else {
      s += " " + getJsExpressionForMetricRule(node.r) + " ";
    }
  } else {
    for (let i = 0; i < node.children.length; i++) {
      if (i != node.children.length - 1) {
        let op = "&&";
        if (node.r.ruleOperator == "OR") {
          op = "||";
        }
        s +=
          " " +
          getBoolExpressionFromRuleNode(node.children[i], false) +
          " " +
          op;
      } else {
        s += " " + getBoolExpressionFromRuleNode(node.children[i], false) + " ";
      }
    }
  }
  if (s == "(") {
    return "true";
  }
  return s + ")";
}

function getJsExpressionForMetricRule(r: Rule) {
  const collapsedEdges4Node = `x.connectedEdges('.${COLLAPSED_EDGE_CLASS}').map(x => x.data('collapsedEdges').filter('.${r.propertyOperand}')).reduce((x, y) => {return x.union(y)}, cy.collection())`;
  if (r.operator == "One of") {
    let s = r.inputOperand;
    s = s.replace(/'/g, "");
    if (r.propertyType == "string") {
      let arr = s.split(",").map((x) => `'${x}'`);
      s = arr.join(",");
    }
    if (r.propertyType == "edge") {
      return `[${s}].includes(x.connectedEdges('.${r.propertyOperand}').union(${collapsedEdges4Node}).length)`;
    }
    return `[${s}].includes(x.data('${r.propertyOperand}'))`;
  }
  if (
    r.propertyType == "int" ||
    r.propertyType == "float" ||
    r.propertyType == "edge"
  ) {
    let op = NEO4J_2_JS_NUMBER_OPERATORS[r.operator];
    if (r.propertyType == "edge") {
      if (op && r.inputOperand) {
        return `x.connectedEdges('.${r.propertyOperand}').union(${collapsedEdges4Node}).length ${op} ${r.inputOperand}`;
      }
      return `x.connectedEdges('.${r.propertyOperand}').union(${collapsedEdges4Node}).length`;
    }
    if (op && r.inputOperand) {
      return `x.data('${r.propertyOperand}') ${op} ${r.inputOperand}`;
    }
    return `x.data('${r.propertyOperand}')`;
  }
  if (r.propertyType == "string") {
    if (r.operator === "=") {
      return `x.data('${r.propertyOperand}') === '${r.inputOperand}'`;
    }
    let op = NEO4J_2_JS_STR_OPERATORS[r.operator];
    if (op && r.inputOperand) {
      return `x.data('${r.propertyOperand}').${op}('${r.inputOperand}')`;
    }
    return `x.data('${r.propertyOperand}')`;
  }
  if (r.propertyType == "list") {
    if (r.inputOperand) {
      return `x.data('${r.propertyOperand}').includes('${r.inputOperand}')`;
    }
    return `x.data('${r.propertyOperand}')`;
  }
  if (r.propertyType.startsWith("enum")) {
    let op = NEO4J_2_JS_NUMBER_OPERATORS[r.operator];
    if (!op || !r.inputOperand) {
      return `x.data('${r.propertyOperand}')`;
    }
    if (r.propertyType.endsWith("string")) {
      return `x.data('${r.propertyOperand}') ${op} '${r.inputOperand}'`;
    } else {
      return `x.data('${r.propertyOperand}') ${op} ${r.inputOperand}`;
    }
  }
}

function r2str(curr: Rule) {
  let s = "";
  let input = "" + curr.inputOperand;
  if (curr.propertyType == "string") {
    input = `"${input}"`;
  }
  s += ` (<b>${curr.propertyOperand}</b> ${curr.operator} <b>${input}</b>) `;
  return s;
}

export function rule2str2(r: ClassBasedRules): string {
  let s = `<b>${r.className}</b>`;
  if (r.rules.children.length == 0 || !r.rules.children[0].r.propertyType) {
    return s;
  }
  s += " where " + ruleNode2str(r.rules);
  return s;
}

function ruleNode2str(node: RuleNode) {
  let s = "(";
  if (!node.r || !node.r.ruleOperator) {
    s += " " + r2str(node.r) + " ";
  } else {
    for (let i = 0; i < node.children.length; i++) {
      if (i != node.children.length - 1) {
        let op = "&&";
        if (node.r.ruleOperator == "OR") {
          op = "||";
        }
        s += " " + ruleNode2str(node.children[i]) + " " + op;
      } else {
        s += " " + ruleNode2str(node.children[i]) + " ";
      }
    }
  }

  return s + ")";
}
