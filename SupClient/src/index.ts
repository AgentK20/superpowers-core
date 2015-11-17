import * as io from "socket.io-client";

import ProjectClient from "./ProjectClient"
import setupHotkeys from "./setupHotkeys";
import * as table from "./table";
import * as dialogs from "./dialogs/index";
export { ProjectClient, setupHotkeys, table, dialogs };

// Refuses filesystem-unsafe characters
// See http://superuser.com/q/358855
//export const namePattern = "[^\\/:*?\"<>|\[\]&]+";
// FIXME: escape character "\" seems to not work properly ?
export const namePattern = "[^/:*?\"<>|]+";
export const namePatternDescription = "The following characters cannot be used: \\, /, :, *, ?, \", <, >, |, [ and ].";

// Initialize empty system
SupCore.system = new SupCore.System("");

export let isApp = window.navigator.userAgent.indexOf("Electron") !== -1;

// Component editors
interface ComponentEditorObject {
  destroy(): void;
  config_setProperty(path: string, value: any): void;
}

interface ComponentEditorClass {
  new(tbody: HTMLTableSectionElement, config: any, projectClient: ProjectClient, editConfig: Function): ComponentEditorObject;
}

export let componentEditorClasses: { [name: string]: ComponentEditorClass } = {};
export function registerComponentEditorClass(name: string, plugin: ComponentEditorClass) {
  if (componentEditorClasses[name] != null) {
    console.error(`SupClient.registerComponentEditorClass: Tried to register two or more classes named "${name}"`);
    return;
  }

  componentEditorClasses[name] = plugin;
};

// Settings editors
interface SettingsEditorClass {
  new(container: HTMLDivElement, projectClient: ProjectClient): {};
}

export let settingsEditorClasses: { [name: string]: SettingsEditorClass } = {};
export function registerSettingsEditorClass(name: string, plugin: SettingsEditorClass) {
  if (settingsEditorClasses[name] != null) {
    console.error(`SupClient.registerSettingsEditorClass: Tried to register two or more classes named "${name}"`);
    return;
  }

  settingsEditorClasses[name] = plugin;
}

// Plugins list
export function connect(projectId: string, options: { reconnection: boolean; promptCredentials: boolean; } = { reconnection: false, promptCredentials: false }) {
  let namespace = (projectId != null) ? `project:${projectId}` : "hub";

  let supServerAuth = localStorage.getItem("supServerAuth");
  let socket = io.connect(`${window.location.protocol}//${window.location.host}/${namespace}`,
    { transports: [ "websocket" ], reconnection: options.reconnection, query: { supServerAuth } }
  );

  socket.on("welcome", (clientId: number, config: { systemName: string; }) => {
    SupCore.system.name = config.systemName;
  });

  if (options.promptCredentials) socket.on("error", onSocketError);
  return socket;
}

function onSocketError(error: string) {
  document.body.innerHTML = "";
  if (error === "invalidCredentials") {
    promptServerPassword((serverPassword) => {
      promptUsername((username) => {
        setupAuth(serverPassword, username);
      });
    });
  }
  else if (error === "invalidUsername") {
    promptUsername((username) => {
      setupAuth("", username);
    });
  }
}

function promptServerPassword(callback: (password: string) => any) {
  dialogs.prompt("Please enter the server password.", "", "", "Connect", { type: "password" }, callback);
}

function promptUsername(callback: (username: string) => any) {
  dialogs.prompt("Please choose a username.", "", "", "Connect", { pattern: "[A-Za-z0-9_]{3,20}" }, callback);
}

function setupAuth(serverPassword: string, username: string) {
  localStorage.setItem("supServerAuth", JSON.stringify({ serverPassword, username }));
  window.location.reload();
}

export function onAssetTrashed() {
  document.body.innerHTML = "";

  let h1 = document.createElement("h1");
  h1.textContent = "This asset has been trashed.";

  let div = document.createElement("div");
  div.className = "superpowers-error";
  div.appendChild(h1);
  document.body.appendChild(div);
}

export function onDisconnected() {
  document.body.innerHTML = "";

  let h1 = document.createElement("h1");
  h1.textContent = "You were disconnected.";

  let button = document.createElement("button");
  button.textContent = "Reconnect";
  button.addEventListener("click", () => { location.reload(); });

  let div = document.createElement("div");
  div.className = "superpowers-error";
  div.appendChild(h1);
  div.appendChild(button);
  document.body.appendChild(div);
}

export function getTreeViewInsertionPoint(treeView: any) {
  let selectedElt = treeView.selectedNodes[0];
  let parentId: string;
  let index: number;

  if (selectedElt != null) {
    if (selectedElt.classList.contains("group")) {
      parentId = selectedElt.dataset.id;
    }
    else {
      if (selectedElt.parentElement.classList.contains("children")) {
        parentId = selectedElt.parentElement.previousSibling.dataset.id;
      }

      index = 1
      while (selectedElt.previousSibling != null) {
        selectedElt = selectedElt.previousSibling;
        if (selectedElt.tagName === "LI") index++;
      }
    }
  }
  return { parentId, index };
}

export function getTreeViewDropPoint(dropInfo: any, treeById: SupCore.Data.Base.TreeById) {
  let parentId: string;
  let index: number;

  let parentNode: any;
  let targetEntryId = dropInfo.target.dataset.id;

  switch (dropInfo.where) {
    case "inside": {
      parentNode = treeById.byId[targetEntryId];
      index = parentNode.children.length;
      break;
    }
    case "above":
    case "below": {
      let targetNode = treeById.byId[targetEntryId];
      parentNode = treeById.parentNodesById[targetNode.id];

      index = (parentNode != null) ? parentNode.children.indexOf(targetNode) : treeById.pub.indexOf(targetNode);

      if (dropInfo.where === "below") index++;
      break;
    }
  }

  if (parentNode != null) parentId = parentNode.id;
  return { parentId, index };
}

export function getListViewDropIndex(dropInfo: any, listById: SupCore.Data.Base.ListById, reversed = false) {
  let targetEntryId = dropInfo.target.dataset.id;
  let targetNode = listById.byId[targetEntryId];

  let index = listById.pub.indexOf(targetNode)
  if (! reversed && dropInfo.where === "below") index++;
  if (  reversed && dropInfo.where === "above") index++;
  return index;
}

export function findEntryByPath(entries: any, path: string|string[]) {
  let parts = (typeof path === "string") ? path.split("/") : path;
  let foundEntry: any;

  entries.every((entry: any) => {
    if (entry.name === parts[0]) {
      if (parts.length === 1) {
        foundEntry = entry;
        return false;
      }

      if (entry.children == null) return true;
      foundEntry = findEntryByPath(entry.children, parts.slice(1));
      return false;
    }
    else return true;
  });

  return foundEntry;
}
