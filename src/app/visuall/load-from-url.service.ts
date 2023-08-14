import { Injectable } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CytoscapeService } from "./cytoscape.service";
import { HttpClient } from "@angular/common/http";
import { HttpErrorResponse } from "@angular/common/http";
import { GlobalVariableService } from "./global-variable.service";

@Injectable({ providedIn: "root" })
export class URLLoadService {
  url: string;
  data: any;
  fileRead: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private _cyService: CytoscapeService,
    private _g: GlobalVariableService
  ) {}

  init() {
    this.route.queryParams.subscribe(async (params) => {
      //if there is a URL query, getData() is invoked, otherwise nothing
      this.url = await params["URL"];
      this.getData();
    });
  }

  getData() {
    if (typeof this.url !== "undefined") {
      //if url is not null, get the data from the given route else wait for 200 ms and try again
      this.http
        .get<any>("urlquery/" + this.url, {
          headers: { "Content-Type": "application/json" },
          observe: "body",
          responseType: "text" as "json",
        })
        .subscribe(
          async (data) => {
            this.data = new File([await data], "Graph", {
              type: "text",
              lastModified: Date.now(),
            });

            //data is taken as json and given to cytoscape's loadFile method as it is in navbar load
            this._cyService.loadFile(this.data);
          },
          (err: HttpErrorResponse) => {
            this._g.showErrorModal(err.name, err.message);
          }
        );
    } else {
      setTimeout(this.getData, 200);
    }
  }
}
