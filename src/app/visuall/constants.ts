export const CY_NAVI_POSITION_WAIT_DUR = 500;
export const MAX_HIGHTLIGHT_WIDTH = 20;
export const MIN_HIGHTLIGHT_WIDTH = 1;
export const MAX_HIGHLIGHT_CNT = 12;
export const MAX_DATA_PAGE_SIZE = 10000;
export const MIN_DATA_PAGE_SIZE = 1;
export const MAX_LENGTH_OF_UP_DOWN_STREAM = 10;
export const MIN_LENGTH_OF_UP_DOWN_STREAM = 1;
export const EXPAND_COLLAPSE_CUE_SIZE = 12;
export const MAX_TABLE_COLUMN_COUNT = 100;
export const MIN_TABLE_COLUMN_COUNT = 1;
export const CSS_SM_TEXT_SIZE = 11;
export const CSS_FONT_NAME = "Arial";
export const CLUSTER_CLASS = "Cluster";
export const LAYOUT_ANIM_DUR = 500;
export const META_EDGE_CLASS = "cy-expand-collapse-meta-edge"; // defined in expand-collapse extension
export const COLLAPSED_EDGE_CLASS = "cy-expand-collapse-collapsed-edge";
export const COLLAPSED_NODE_CLASS = "cy-expand-collapse-collapsed-node";
export const HIGHLIGHT_OPACITY = 0.2;
export const HIGHLIGHT_ANIM_DUR = 400; // it is more reasonable to make HIGHLIGHT_ANIM_DUR * 2 < HIGHLIGHT_WAIT_DUR
export const HIGHLIGHT_WAIT_DUR = 1500;
export const EV_MOUSE_ON = "mouseover";
export const EV_MOUSE_OFF = "mouseout";
export const CY_BATCH_END_DELAY = 100;
export const OBJ_INFO_UPDATE_DELAY = 200;
export const PATH_WALK_NAME_DISALLOWED_REGEX =
  /[.\-+()[\]{} :,\//\\'"\?!;=<>&|%@#^*~`´]/g;
export const BADGE_ZOOM_THRESHOLD = 0.8;
export const BADGE_DEFAULT_NODE_SIZE = 40;
export const BADGE_POPPER_UPDATE_DELAY = 100;

export const EXPAND_COLLAPSE_FAST_OPT = {
  layoutBy: null,
  fisheye: false,
  animate: false,
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

export const TYPES_NOT_TO_SHOW = ["PATHS", "WALKS", "PSEUDO"];

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
// get propperty names of types. If types does not exists get all
export function getPropNamesFromObj(objects, types) {
  let s1 = new Set<string>();

  for (const obj of objects) {
    for (const [, value] of Object.entries(obj)) {
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
  for (let elem of setB) {
    _union.add(elem);
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

export function isPrimitiveType(o) {
  const t = typeof o;
  return t == "string" || t == "number" || t == "boolean";
}

export function extend(a, b) {
  if (a == undefined || a == null) {
    a = {};
  }

  for (let key in b) {
    if (b.hasOwnProperty(key)) {
      a[key] = b[key];
    }
  }

  return a;
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
  wid: number
): { node: any; edge: any } {
  return {
    node: {
      "underlay-color": color,
      "underlay-opacity": HIGHLIGHT_OPACITY,
      "underlay-padding": wid,
    },
    edge: {
      "underlay-color": color,
      "underlay-opacity": HIGHLIGHT_OPACITY,
      "underlay-padding": (e) => {
        return (wid + e.width()) / 2 + "px";
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

export function mapColor(colorEnd: string, valueEnd: number, val: number) {
  if (colorEnd[0] == "#") {
    colorEnd = colorEnd.slice(1, colorEnd.length);
  }
  let r = parseInt(colorEnd.slice(0, 2), 16);
  let g = parseInt(colorEnd.slice(2, 4), 16);
  let b = parseInt(colorEnd.slice(4, 6), 16);

  let rVal = Math.round(r + (255 - r) * (1 - val / valueEnd)).toString(16);
  let gVal = Math.round(g + (255 - g) * (1 - val / valueEnd)).toString(16);
  let bVal = Math.round(b + (255 - b) * (1 - val / valueEnd)).toString(16);
  if (rVal.length < 2) {
    rVal = "0" + rVal;
  }
  if (gVal.length < 2) {
    gVal = "0" + gVal;
  }
  if (bVal.length < 2) {
    bVal = "0" + bVal;
  }
  return "#" + rVal + gVal + bVal;
}
