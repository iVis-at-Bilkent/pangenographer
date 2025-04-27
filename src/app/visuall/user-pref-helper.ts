import {
  MAX_DATA_PAGE_SIZE,
  MAX_TABLE_COLUMN_COUNT,
  MIN_DATA_PAGE_SIZE,
  MIN_TABLE_COLUMN_COUNT,
} from "./constants";
import { CytoscapeService } from "./cytoscape.service";
import { GlobalVariableService } from "./global-variable.service";
import { UserProfileService } from "./user-profile.service";

export class UserPrefHelper {
  constructor(
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService,
    private _profile: UserProfileService
  ) {}

  listen4UserPref() {
    this._g.isUserPrefReady.subscribe((isReady) => {
      if (!isReady) {
        return;
      }
      this.loadPrefFromLocalStorage();
      // bind view utilities after UserPreferences are finalized
      this._cyService.bindViewUtilitiesExtension();

      const up = this._g.userPreferences;

      up.isAutoIncrementalLayoutOnChange.subscribe((x) => {
        this.changeAutoIncremental(x);
      });
      up.isHighlightOnHover.subscribe((x) => {
        this._cyService.highlighterCheckBoxClicked(x);
      });
      up.isShowOverviewWindow.subscribe((x) => {
        this._cyService.navigatorCheckBoxClicked(x);
      });
      up.isShowEdgeLabels.subscribe(() => {
        this._cyService.showHideEdgeLabels();
      });
      up.nodeLabelWrap.subscribe(() => {
        this._cyService.fitLabel2Node();
      });
      up.queryResultPageSize.subscribe((x) => {
        this.dataPageSizeChanged(x);
      });
      up.dataPageLimit.subscribe((x) => {
        this.dataPageLimitChanged(x);
      });
      up.tableColumnLimit.subscribe((x) => {
        this.tableColumnLimitChanged(x);
      });
      up.compoundPadding.subscribe((x) => {
        this.changeCompoundPadding(x);
      });
      up.groupingOption.subscribe((x) => {
        this._cyService.changeGroupingOption(x);
      });

      // PanGenoGrapher Settings
      // Change the length of upstream/downstream function
      up.isEmphasizeInZeroOutZero.subscribe(() => {
        this._g.prepareZeroIncomerAndOutgoerNodes();
      });

      // Change the show upstream/downstream cues function
      up.isShowUpDownstreamCues.subscribe(() => {
        this._cyService.changeShowUpDownstreamCues();
      });
    });
  }

  changeAutoIncremental(x: boolean) {
    if (x) {
      this._g.expandCollapseApi.setOption(
        "layoutBy",
        this.expandCollapseLayout.bind(this)
      );
      this._g.expandCollapseApi.setOption("fisheye", true);
      this._g.expandCollapseApi.setOption("animate", true);
    } else {
      this._g.expandCollapseApi.setOption("layoutBy", null);
      this._g.expandCollapseApi.setOption("fisheye", false);
      this._g.expandCollapseApi.setOption("animate", false);
    }
  }

  private expandCollapseLayout() {
    const l = this._g.getFcoseOptions();
    l.fit = false;
    const elements4layout = this._g.cy.elements().not(":hidden, :transparent");
    if (elements4layout.length < 1) {
      return;
    }
    this._g.isLoadFromExpandCollapse = true;
    elements4layout.layout(l).run();
  }

  changeCompoundPadding(x: string) {
    this._g.cy.style().selector(":compound").style({ padding: x }).update();
  }

  dataPageSizeChanged(x: number) {
    if (x > MAX_DATA_PAGE_SIZE) {
      x = MAX_DATA_PAGE_SIZE;
      this._g.userPreferences.queryResultPageSize.next(x);
      return;
    }
    if (x < MIN_DATA_PAGE_SIZE) {
      x = MIN_DATA_PAGE_SIZE;
      this._g.userPreferences.queryResultPageSize.next(x);
      return;
    }
  }

  dataPageLimitChanged(x: number) {
    if (x > MAX_DATA_PAGE_SIZE) {
      x = MAX_DATA_PAGE_SIZE;
      this._g.userPreferences.dataPageLimit.next(x);
      return;
    }
    if (x < MIN_DATA_PAGE_SIZE) {
      x = MIN_DATA_PAGE_SIZE;
      this._g.userPreferences.dataPageLimit.next(x);
      return;
    }
  }

  tableColumnLimitChanged(x: number) {
    if (x > MAX_TABLE_COLUMN_COUNT) {
      x = MAX_TABLE_COLUMN_COUNT;
      this._g.userPreferences.tableColumnLimit.next(x);
      return;
    }
    if (x < MIN_TABLE_COLUMN_COUNT) {
      x = MIN_TABLE_COLUMN_COUNT;
      this._g.userPreferences.tableColumnLimit.next(x);
      return;
    }
  }

  private loadPrefFromLocalStorage() {
    if (this._profile.isStoreProfile()) {
      this._profile.transferUserPreferences();
    }
    this._profile.transferIsStoreUserProfile();
  }
}
