import { Injectable } from '@angular/core';
import { CytoscapeService } from '../visuall/cytoscape.service';
import { GlobalVariableService } from '../visuall/global-variable.service';
import { GroupingOptionTypes } from '../visuall/user-preference';

@Injectable({
  providedIn: 'root'
})
export class GroupCustomizationService {
  private _clusteringMethods: { name: string, fn: any }[];
  get clusteringMethods(): { name: string, fn: any }[] {
    return this._clusteringMethods;
  }

  constructor(private _g: GlobalVariableService, private _cyService: CytoscapeService) {
    this._clusteringMethods = [{ name: 'By director', fn: () => { this.clusterByDirector(); } }];
  }

  clusterByDirector() {
    let directorEdges = this._g.cy.edges('.DIRECTOR').filter(':visible');
    let directorIds = new Set<string>();
    let movie2director = {};
    for (let i = 0; i < directorEdges.length; i++) {
      let edgeData = directorEdges[i].data();
      directorIds.add(edgeData.source);
      if (movie2director[edgeData.target]) {
        movie2director[edgeData.target].push(edgeData.source);
      } else {
        movie2director[edgeData.target] = [edgeData.source];
      }
    }

    if (this._g.userPrefs.groupingOption.getValue() == GroupingOptionTypes.compound) {
      // add parent nodes
      for (let id of directorIds) {
        // for each director, generate a compound node
        this._cyService.addParentNode(id);
        // add the director to the compound node
        this._g.cy.elements(`[id = "${id}"]`).move({ parent: 'c' + id });
      }

      // assign nodes to parents
      for (let [k, v] of Object.entries(movie2director)) {
        // if a movie has less than 2 directors add, those movies to the cluster of director
        if (v['length'] < 2) {
          // add movies to the compound node
          this._g.cy.elements(`[id = "${k}"]`).move({ parent: 'c' + v[0] });
        }
      }
    } else {
      const clusters = {};
      for (let id of directorIds) {
        clusters[id] = [id];
      }
      for (let [k, v] of Object.entries(movie2director)) {
        // if a movie has less than 2 directors add, those movies to the cluster of director
        if (v['length'] < 2) {
          clusters[v[0]].push(k);
        }
      }
      this._g.layout.clusters = Object.values(clusters);
    }
  }
}
