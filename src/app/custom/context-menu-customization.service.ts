import { Injectable } from "@angular/core";
import { CytoscapeService } from "../visuall/cytoscape.service";
import { DbAdapterService } from "../visuall/db-service/db-adapter.service";
import { GlobalVariableService } from "../visuall/global-variable.service";
import { ContextMenuItem } from "../visuall/context-menu/icontext-menu";
import { DbQueryMeta, HistoryMetaData } from "../visuall/db-service/data-types";
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: "root",
})

/** Custom menu items and action functions for the items should be added to this class.
 * You might need to import other services but you should only edit this file.
 * Using 'menu' function, provided items will be added to toolbar.
 * 'isStd' property must be false for all items.
 * If 'dropdown' is not existing inside standard menu, it will be added as a new item.
 sample menu   
this._menu = [{
      div: 12, items: [{ title: 'Custom Action 1', isRegular: true, fn: 'fn1', isStd: false, imgSrc: '' }]
    },
    {
      div: 1, items: [{ title: 'Custom Action 2', isRegular: true, fn: 'fn2', isStd: false, imgSrc: '' }]
    }];
 **/
export class ContextMenuCustomizationService {
  private _menu: ContextMenuItem[];
  private _movie_api_url = "https://www.omdbapi.com";
  private _api_key_param = "&apikey=9be27fce";
  private _act_types = ["ACTOR", "ACTRESS"];
  private _non_act_types = [
    "DIRECTOR",
    "WRITER",
    "PRODUCER",
    "EDITOR",
    "COMPOSER",
    "CINEMATOGRAPHER",
    "PRODUCTION_DESIGNER",
    "ARCHIVE_FOOTAGE",
    "ARCHIVE_SOUND",
  ];

  get menu(): ContextMenuItem[] {
    return this._menu;
  }
  constructor(
    private _cyService: CytoscapeService,
    private _dbService: DbAdapterService,
    private _g: GlobalVariableService,
    private _http: HttpClient
  ) {
    this._menu = [
      {
        id: "showMoviesPlayedIn",
        content: "Show Titles Played In",
        selector: "node.Person",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show Titles Played by: " },
            { edgeType: this._act_types }
          );
        },
      },
      {
        id: "showMoviesWorkedIn",
        content: "Show Titles Worked In",
        selector: "node.Person",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show Titles Worked by: " },
            { edgeType: this._non_act_types }
          );
        },
      },
      {
        id: "showMoviesOfPerson",
        content: "Show All Titles",
        selector: "node.Person",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show All Titles of person: " },
            {}
          );
        },
      },
      {
        id: "getPoster",
        content: "Use Title Poster",
        selector: "node.Title",
        onClickFunction: this.getPoster.bind(this),
      },
      {
        id: "go to IMDB",
        content: "Go to IMDB",
        selector: "node.Title",
        onClickFunction: this.goInfo.bind(this),
      },
      {
        id: "showActorsOfMovie",
        content: "Show Actors/Actresses",
        selector: "node.Title",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show Actors/Actresses of movie: " },
            { edgeType: this._act_types }
          );
        },
      },
      {
        id: "showOtherStaffOfMovie",
        content: "Show Other Staff",
        selector: "node.Title",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show Other Staff of movie: " },
            { edgeType: this._non_act_types }
          );
        },
      },
      {
        id: "showAllPersonsOfMovie",
        content: "Show All Persons",
        selector: "node.Title",
        onClickFunction: (x) => {
          this.getNeighbors(
            x,
            { isNode: true, customTxt: "Show All Persons of movie: " },
            {}
          );
        },
      },
    ];
  }

  getNeighbors(event, historyMeta: HistoryMetaData, queryMeta: DbQueryMeta) {
    const ele = event.target || event.cyTarget;
    this._dbService.getNeighbors(
      [ele.id().substr(1)],
      (x) => {
        this._cyService.loadElementsFromDatabase(x, true);
      },
      historyMeta,
      queryMeta
    );
  }

  getPoster(event) {
    const ele = event.target || event.cyTarget;
    this.setBgImg2MoviePoster(ele);
  }

  goInfo(event) {
    const ele = event.target || event.cyTarget;
    const id = ele.data("tconst");
    window.open("https://www.imdb.com/title/" + id);
  }

  useMoviePoster() {
    this._g.cy.nodes(".Title").forEach((e) => {
      this.setBgImg2MoviePoster(e);
    });
  }

  private setBgImg2MoviePoster(e) {
    const id = e.data("tconst");
    this._http
      .get(this._movie_api_url + `?i=${id}` + this._api_key_param)
      .subscribe({
        next: (response: any) => {
          const url = response.Poster;
          if (url && url != "" && url != "N/A") {
            this._http
              .get(url, { responseType: 'blob' })
              .subscribe({
                next: () => {
                  e.style({ "background-image": url });
                }, error: (e) => {
                  this._g.showErrorModal(
                    "Use Title Poster",
                    "Poster(s) does not exist!"
                  );
                }
              })

          }
        }, error: (err) => {
          this._g.showErrorModal("Background Image", err);
        }
      });
  }
}
