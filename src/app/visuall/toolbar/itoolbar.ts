export interface ToolbarDiv {
  // id for the div
  div: number;
  // will be shown inside the dropdown button
  items: ToolbarAction[];
}

export interface ToolbarAction {
  // path to the image
  imgSrc: string;
  // will be showed on mouse over
  title: string;
  // must be the name of function, function should be parameterless
  fn: string;
  // irregular DOM elements should be hard coded to HTML
  isRegular: boolean;
}
