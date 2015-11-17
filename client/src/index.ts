import hub from "./hub";
import project from "./project";

let qs = require("querystring").parse(window.location.search.slice(1));

if (qs.project != null) project(qs.project);
else hub();

if (!SupClient.isApp) document.body.classList.add("browser");
else {
  let nodeRequire = require;
  let remote: GitHubElectron.Remote = nodeRequire("remote");
  let win = remote.getCurrentWindow();

  function onMinimizeWindowClick() { win.minimize(); }

  function onMaximizeWindowClick() {
    let maximized = screen.availHeight <= win.getSize()[1];
    if (maximized) win.unmaximize();
    else win.maximize();
  }

  function onCloseWindowClick() { window.close(); }

  document.querySelector(".controls .minimize").addEventListener("click", onMinimizeWindowClick);
  document.querySelector(".controls .maximize").addEventListener("click", onMaximizeWindowClick);
  document.querySelector(".controls .close").addEventListener("click", onCloseWindowClick);

  let link = document.querySelector("a.superpowers");
  if (link != null) link.addEventListener("click", (event: any) => {
    event.preventDefault();
    let shell: GitHubElectron.Shell = nodeRequire("shell");
    shell.openExternal(event.target.href);
  });
}
