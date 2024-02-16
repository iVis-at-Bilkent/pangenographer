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

  private getUserPrefs() {
    const p = this.getUserProfile();
    if (p) {
      return p.userPref;
    }
    return null;
  }

  private userPref2RawData() {
    const o = {};
    this.mapSubjectProperties(this._g.userPrefs, o);
    return o;
  }

  private mapSubjectProperties(obj, mappedObj) {
    for (const k in obj) {
      if (obj[k] instanceof BehaviorSubject) {
        mappedObj[k] = (obj[k] as BehaviorSubject<any>).getValue();
      } else {
        if (obj[k] instanceof Array) {
          mappedObj[k] = [];
        } else {
          mappedObj[k] = {};
        }
        this.mapSubjectProperties(obj[k], mappedObj[k]);
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
        p.userPref = undefined;
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
      !p.userPref ||
      p.userPref.isStoreUserProfile === undefined ||
      p.userPref.isStoreUserProfile == null
    ) {
      return this._g.userPrefs.isStoreUserProfile;
    }
    return p.userPref.isStoreUserProfile;
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

  transferUserPrefs() {
    const p = this.getUserPrefs();
    this._g.transfer2UserPrefs(p);
  }

  transferIsStoreUserProfile() {
    const p = this.getUserProfile();
    if (p && p.userPref && typeof p.userPref.isStoreUserProfile === "boolean") {
      this._g.userPrefs.isStoreUserProfile.next(p.userPref.isStoreUserProfile);
    }
  }

  saveUserPrefs() {
    const p = this.getUserProfile();
    if (p) {
      p.userPref = this.userPref2RawData();
      localStorage.setItem("profile", JSON.stringify(p));
    } else {
      const up = this.userPref2RawData();
      localStorage.setItem("profile", JSON.stringify({ userPref: up }));
    }
  }
}
