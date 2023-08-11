export interface ContextMenuItem {
  id: string;
  content: string;
  selector?: string
  onClickFunction?: (event: any) => void;
  // must be false for custom items
  coreAsWell?: boolean;
  submenu?: Array<ContextMenuItem>;
}