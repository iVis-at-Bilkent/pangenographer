import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { GlobalVariableService } from "./global-variable.service";
import {
  QueryRule,
  RuleNode,
  deepCopyQueryRules,
} from "./operation-tabs/map-tab/query-types";
import { UserProfile } from "./user-preference";

@Injectable({
  providedIn: "root",
})
export class UserProfileService {
  onLoadFromFile: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false
  );
  constructor(private _g: GlobalVariableService) {}

  private getUserProfile() {
    const p = localStorage.getItem("profile");
    if (!p) {
      return null;
    }
    return JSON.parse(p) as UserProfile;
  }

  private deleteParents(root: RuleNode) {
    root.parent = null;
    for (const child of root.children) {
      this.deleteParents(child);
    }
  }

  addParents(root: RuleNode) {
    for (const child of root.children) {
      child.parent = root;
      this.addParents(child);
    }
  }

  private getUserPreferences() {
    const p = this.getUserProfile();
    if (p) {
      return p.userPreference;
    }
    return null;
  }

  private userPreference2RawData() {
    const o = {};
    this.mapSubjectProperties(this._g.userPreferences, o);
    return o;
  }

  private mapSubjectProperties(object: any, mappedObject: any) {
    for (const k in object) {
      if (object[k] instanceof BehaviorSubject) {
        mappedObject[k] = (object[k] as BehaviorSubject<any>).getValue();
      } else {
        if (object[k] instanceof Array) {
          mappedObject[k] = [];
        } else {
          mappedObject[k] = {};
        }
        this.mapSubjectProperties(object[k], mappedObject[k]);
      }
    }
  }

  getQueryRules(): QueryRule[] {
    const p = this.getUserProfile();
    if (p && p.queryRules) {
      return p.queryRules;
    }
    return [];
  }

  downloadProfileAsFile(isSaveSettings = true, isSaveQueryRules = true) {
    const p = this.getUserProfile();
    if (p) {
      if (!isSaveSettings) {
        p.userPreference = undefined;
      }
      if (!isSaveQueryRules) {
        p.queryRules = undefined;
      }
    }
    const str = JSON.stringify(p);
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(str)
    );
    element.setAttribute("download", "Visuall_User_Profile.vall");

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  setUserProfile(txt: string) {
    localStorage.setItem("profile", txt);
    this.onLoadFromFile.next(true);
  }

  isStoreProfile() {
    const p = this.getUserProfile();
    if (
      !p ||
      !p.userPreference ||
      p.userPreference.isStoreUserProfile === undefined ||
      p.userPreference.isStoreUserProfile == null
    ) {
      return this._g.userPreferences.isStoreUserProfile;
    }
    return p.userPreference.isStoreUserProfile;
  }

  saveQueryRules(f: QueryRule[]) {
    const p = this.getUserProfile();
    if (p) {
      let m2 = deepCopyQueryRules(f);
      for (const m of m2) {
        this.deleteParents(m.rules.rules);
      }
      p.queryRules = m2;
      localStorage.setItem("profile", JSON.stringify(p));
    } else {
      localStorage.setItem("profile", JSON.stringify({ queryRules: f }));
    }
  }

  transferUserPreferences() {
    const p = this.getUserPreferences();
    this._g.transfer2UserPreferences(p);
  }

  transferIsStoreUserProfile() {
    const p = this.getUserProfile();
    if (
      p &&
      p.userPreference &&
      typeof p.userPreference.isStoreUserProfile === "boolean"
    ) {
      this._g.userPreferences.isStoreUserProfile.next(
        p.userPreference.isStoreUserProfile
      );
    }
  }

  saveUserPreferences() {
    const p = this.getUserProfile();
    if (p) {
      p.userPreference = this.userPreference2RawData();
      localStorage.setItem("profile", JSON.stringify(p));
    } else {
      const up = this.userPreference2RawData();
      localStorage.setItem("profile", JSON.stringify({ userPreference: up }));
    }
  }
}
