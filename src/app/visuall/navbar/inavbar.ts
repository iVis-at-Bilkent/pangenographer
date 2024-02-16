export interface NavbarDropdown {
  // will be shown as a dropdown button
  dropdown: string;
  // will be shown inside the dropdown button
  actions: NavbarAction[];
}

export interface NavbarAction {
  // only used to make unit testing easier
  id: string;
  // used to show on navbar
  txt: string;
  // must be the name of function, function should be parameterless
  fn?: string;
  // used for custom items
  actions?: NavbarAction[];
}
