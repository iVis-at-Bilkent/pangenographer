export const CY_NAVI_POSITION_WAIT_DUR = 500;
export const MAX_HIGHLIGHT_WIDTH = 20;
export const MIN_HIGHLIGHT_WIDTH = 1;
export const MAX_HIGHLIGHT_CNT = 12;
export const MAX_DATA_PAGE_SIZE = 10000;
export const MIN_DATA_PAGE_SIZE = 1;
export const MAX_LENGTH_OF_UP_DOWN_STREAM = 10;
export const MIN_LENGTH_OF_UP_DOWN_STREAM = 1;
export const MAX_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH = 10;
export const MIN_LENGTH_OF_BLAST_SELECTED_SEGMENTS_PATH = 1;
export const EXPAND_COLLAPSE_CUE_SIZE = 12;
export const MAX_TABLE_COLUMN_COUNT = 100;
export const MIN_TABLE_COLUMN_COUNT = 1;
export const CSS_SM_TEXT_SIZE = 11;
export const CSS_FONT_NAME = "Arial";
export const CLUSTER_CLASS = "Cluster";
export const LAYOUT_ANIMATION_DURATION = 500;
export const MIN_MESSAGE_DURATION = 1000;
export const META_EDGE_CLASS = "cy-expand-collapse-meta-edge"; // defined in expand-collapse extension
export const COLLAPSED_EDGE_CLASS = "cy-expand-collapse-collapsed-edge";
export const COLLAPSED_NODE_CLASS = "cy-expand-collapse-collapsed-node";
export const HIGHLIGHT_OPACITY = 0.2;
export const HIGHLIGHT_ANIM_DUR = 400; // it is more reasonable to make HIGHLIGHT_ANIM_DUR * 2 < HIGHLIGHT_WAIT_DUR
export const HIGHLIGHT_WAIT_DUR = 1500;
export const EV_MOUSE_ON = "mouseover";
export const EV_MOUSE_OFF = "mouseout";
export const TABLE_TOOLTIP_SHOW_LIMIT = 200;
export const CY_BATCH_END_DELAY = 100;
export const TABLE_ALL_CHECK_DELAY = 100;
export const OBJ_INFO_UPDATE_DELAY = 200;
export const PATH_WALK_NAME_DISALLOWED_REGEX =
  /[.\-+()[\]{} :,\//\\'"\?!;=<>&|%@#^*~`´]/g;
export const CQL_QUERY_CHANGE_MARKER = "CQL_QUERY_CHANGE_MARKER";
export const BADGE_ZOOM_THRESHOLD = 0.8;
export const DEFAULT_NODE_WIDTH = 36;
export const DEFAULT_NODE_HEIGHT = 18;
export const MIN_NODE_WIDTH = DEFAULT_NODE_WIDTH * 0.85;
export const BADGE_POPPER_UPDATE_DELAY = 100;
export const OVERLAP_REGEX = /[MIDNSHPX=]/;

export const EXPAND_COLLAPSE_FAST_OPT = {
  layoutBy: null,
  fisheye: false,
  animate: false,
};

export const PANGENOGRAPHER_SETTING_NAMES = [
  "isEmphasizeInZeroOutZero",
  "isShowUpDownstreamCues",
  "lengthOfBlastSelectedSegmentsPath",
  "lengthOfUpDownstream",
  "seedSourceTargetCount",
  "sizeOfGetSampleData",
  "sizeOfNeo4jQueryBatchesInCharacters",
  "sizeOfNeo4jQueryBatchesInLines",
  "segmentDataSizeQueryLimit",
];

export const GRAPH_THEORETIC_QUERY_NAMES = {
  degreeCentrality: "Degree Centrality",
  degreeCentralityNormalized: "Normalized Degree Centrality",
  interGroupDegreeCentrality: "Inter-Group Degree Centrality",
  interGroupDegreeCentralityNormalized:
    "Normalized Inter-Group Degree Centrality",
  closenessCentrality: "Closeness Centrality",
  closenessCentralityNormalized: "Normalized Closeness Centrality",
  betweennessCentrality: "Betweenness Centrality",
  betweennessCentralityNormalized: "Normalized Betweenness Centrality",
  pageRank: "Page Rank",
};

export const CUE_CONFIG = {
  marginY: 19,
  marginX: 9,
  marginXTwo: 6,
  width: 12,
};

export const TOOLTIP_CONFIG = {
  widthOffset: 11,
  fontSize: "15",
  fontWeight: "700",
  fontFamily: "Inconsolata, monospace",
  fontStyle: "normal",
};

export const COMBINED_SEQUENCE_THRESHOLDS = {
  firstThreshold: 20,
  secondThreshold: 200,
  thirdThreshold: 20,
};

export const HIGHLIGHT_INDEX = {
  zeroIndegree: 0,
  zeroOutdegree: 1,
};

export const HIGHLIGHT_NAMES = ["Zero Indegree", "Zero Outdegree"];

export const GENERIC_TYPE = {
  ANY_CLASS: "Any Object",
  NOT_SELECTED: "───",
  NODES_CLASS: "Any Node",
  EDGES_CLASS: "Any Edge",
};

export const NUMBER_OPERATORS = {
  "=": "=",
  "\u2260": "<>",
  "<": "<",
  ">": ">",
  "\u2264": "<=",
  "\u2265": ">=",
  "one of": "One of",
};

export const ENUM_OPERATORS = {
  "=": "=",
  "\u2260": "<>",
  "one of": "One of",
};

export const SAMPLE_DATABASES = [
  "Freebase",
  "Minigraph GRCh38 Human Pangenome",
  "Human HLA Pangenome",
  "Bifrost Ecoli Pangenome",
  "PGGB Ecoli Pangenome",
];

export const CYPHER_WRITE_QUERY_TYPES = [
  "CREATE",
  "MERGE",
  "SET",
  "DELETE",
  "REMOVE",
];

export const TEXT_OPERATORS = {
  "equal to": "=",
  contains: "Contains",
  "starts with": "Starts with",
  "ends with": "Ends with",
  "one of": "One of",
};

export const LIST_OPERATORS = {
  in: "In",
};

export const NEO4J_2_JS_NUMBER_OPERATORS = {
  "=": "===",
  "<>": "!==",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
};

export const NEO4J_2_JS_STR_OPERATORS = {
  Contains: "includes",
  "Starts with": "startsWith",
  "Ends with": "endsWith",
};

export const TYPES_NOT_TO_SHOW = ["PATH", "WALK", "PSEUDO"];

export const GFA_SEGMENT_PROPERTIES_NOT_TO_SHOW = [
  "elementId",
  "id",
  "deleted",
  "type",
];

/** https://davidwalsh.name/javascript-debounce-function
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 * @param  {} func
 * @param  {number} wait
 * @param  {boolean=false} immediate
 * @param  {} preConditionFn=null if function returns false, ignore this call
 */
export function debounce(
  func: Function,
  wait: number,
  immediate: boolean = false,
  preConditionFn = null
) {
  let timeout: any;
  return function () {
    if (preConditionFn && !preConditionFn()) {
      return;
    }
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// calls fn2 at the beginning of frequent calls to fn1
export function debounce2(fn1: Function, wait: number, fn2: Function) {
  let timeout: any;
  let isInit = true;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      fn1.apply(context, args);
      isInit = true;
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (isInit) {
      fn2.apply(context, args);
      isInit = false;
    }
  };
}

// objects is an array of objects, types is an array of strings
// get property names of types. If types does not exists get all
export function getPropNamesFromObject(objects: any, types: any) {
  let s1 = new Set<string>();

  for (const object of objects) {
    for (const [, value] of Object.entries(object)) {
      for (const [k2, v2] of Object.entries(value)) {
        if (!types) {
          s1.add(k2);
        } else if (types.includes(v2)) {
          s1.add(k2);
        }
      }
    }
  }
  return s1;
}

// return union of 2 sets
export function union(setA: any, setB: any) {
  let _union = new Set(setA);
  for (let element of setB) {
    _union.add(element);
  }
  return _union;
}

export function isClose(a1: number, a2: number, margin = 1000) {
  return Math.abs(a1 - a2) < margin;
}

export function expandCollapseCuePosition(node) {
  const zoom = node._private.cy.zoom();
  let smallness = 1 - node.renderedWidth() / node._private.cy.width();
  if (smallness < 0) {
    smallness = 0;
  }
  // cue size / 2
  const rectSize = EXPAND_COLLAPSE_CUE_SIZE / 2;
  const offset = parseFloat(node.css("border-width")) + rectSize;
  let size = zoom < 1 ? rectSize / zoom : rectSize;
  let add = offset * smallness + size;
  const x =
    node.position("x") -
    node.width() / 2 -
    parseFloat(node.css("padding-left")) +
    add;
  const y =
    node.position("y") -
    node.height() / 2 -
    parseFloat(node.css("padding-top")) +
    add;
  return { x: x, y: y };
}

export function areSetsEqual(s1: Set<any>, s2: Set<any>) {
  if (!s1 || !s2) {
    return false;
  }

  for (let i of s1) {
    if (!s2.has(i)) {
      return false;
    }
  }

  for (let i of s2) {
    if (!s1.has(i)) {
      return false;
    }
  }
  return true;
}

export function compareUsingOperator(a: any, b: any, op: string) {
  op = op.toLowerCase();
  switch (op) {
    case "=":
      return a === b;
    case "<>":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case "contains":
    case "in":
      return a.includes(b);
    case "starts with":
      return a.startsWith(b);
    case "ends with":
      return a.endsWith(b);
    default:
      return false;
  }
}

export function isNumber(value: string | number): boolean {
  return value != null && !isNaN(Number(value.toString()));
}

/**
 * Deep copy function for TypeScript.
 * @param T Generic type of target/copied value.
 * @param target Target value to be copied.
 * @see Source project, ts-deepcopy https://github.com/ykdr2017/ts-deepcopy
 * @see Code pen https://codepen.io/erikvullings/pen/ejyBYg
 */
export const deepCopy = <T>(target: T): T => {
  if (target === null) {
    return target;
  }
  if (target instanceof Array) {
    const cp = [] as any[];
    (target as any[]).forEach((v) => {
      cp.push(v);
    });
    return cp.map((n: any) => deepCopy<any>(n)) as any;
  }
  if (typeof target === "object") {
    const cp = { ...(target as { [key: string]: any }) } as {
      [key: string]: any;
    };
    Object.keys(cp).forEach((k) => {
      cp[k] = deepCopy<any>(cp[k]);
    });
    return cp as T;
  }
  return target;
};

export function arrayDiff(smallArr: string[], bigArr: string[]): string[] {
  let diff: string[] = [];
  let d = {};
  for (let i = 0; i < smallArr.length; i++) {
    d[smallArr[i]] = true;
  }

  for (let i = 0; i < bigArr.length; i++) {
    if (!d[bigArr[i]]) {
      diff.push(bigArr[i]);
    }
  }
  return diff;
}

export function getCyStyleFromColorAndWid(
  color: string,
  width: number
): { node: any; edge: any } {
  return {
    node: {
      "underlay-color": color,
      "underlay-opacity": HIGHLIGHT_OPACITY,
      "underlay-padding": width,
    },
    edge: {
      "underlay-color": color,
      "underlay-opacity": HIGHLIGHT_OPACITY,
      "underlay-padding": (e) => {
        return (width + e.width()) / 2 + "px";
      },
    },
  };
}

export function isJson(str: string) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export function mapColor(colorEnd: string, valueEnd: number, value: number) {
  if (colorEnd[0] == "#") {
    colorEnd = colorEnd.slice(1, colorEnd.length);
  }
  let r = parseInt(colorEnd.slice(0, 2), 16);
  let g = parseInt(colorEnd.slice(2, 4), 16);
  let b = parseInt(colorEnd.slice(4, 6), 16);

  let rValue = Math.round(r + (255 - r) * (1 - value / valueEnd)).toString(16);
  let gValue = Math.round(g + (255 - g) * (1 - value / valueEnd)).toString(16);
  let bValue = Math.round(b + (255 - b) * (1 - value / valueEnd)).toString(16);
  if (rValue.length < 2) {
    rValue = "0" + rValue;
  }
  if (gValue.length < 2) {
    gValue = "0" + gValue;
  }
  if (bValue.length < 2) {
    bValue = "0" + bValue;
  }
  return "#" + rValue + gValue + bValue;
}
