export default function() {
  let isBackspaceDown = false;

  document.addEventListener("keydown", (event) => {
    if (document.querySelector(".dialog") != null) return;

    // window.location.origin isn't listed in lib.d.ts as of TypeScript 1.5
    let origin: string = (<any>window.location).origin;

    function sendMessage(action: string) {
      if (window.parent != null) window.parent.postMessage({ type: "hotkey", content: action }, origin);
      else window.postMessage({ type: "hotkey", content: action }, origin);
    }

    if (localStorage.getItem("superpowers-dev-mode") != null && window.parent != null) {
      window.onerror = () => { window.parent.postMessage({ type: "error" }, origin); };
    }

    if (event.keyCode === 8 /* Backspace */) isBackspaceDown = true;

    if (event.keyCode === 78 && (event.ctrlKey || event.metaKey)) { // CTRL-N
      event.preventDefault();
      if (event.shiftKey) sendMessage("newFolder");
      else sendMessage("newAsset");
    }

    if ((event.keyCode === 79 || event.keyCode === 80) && (event.ctrlKey || event.metaKey)) { // CTRL-O or CTRL-P
      event.preventDefault(); sendMessage("searchEntry");
    }

    if (event.keyCode === 87 && (event.ctrlKey || event.metaKey)) { // CTRL-W
      event.preventDefault(); sendMessage("closeTab");
    }

    if (event.keyCode === 9 && event.ctrlKey) { // CTRL-TAB
      event.preventDefault();
      if (event.shiftKey) sendMessage("previousTab");
      else sendMessage("nextTab");
    }

    if (event.keyCode === 116 || (event.keyCode === 80 && event.metaKey)) { // F5 || Cmd-P
      event.preventDefault(); sendMessage("run");
    }
    if (event.keyCode === 117 || (event.keyCode === 80 && event.metaKey && event.shiftKey)) { // F6 or Cmd-Shift-P
      event.preventDefault(); sendMessage("debug");
    }

    if (event.keyCode === 123) { // F12
      sendMessage("devtools");
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.keyCode === 8 /* Backspace */) isBackspaceDown = false;
  });

  window.addEventListener("beforeunload", (event) => {
    if (isBackspaceDown) {
      isBackspaceDown = false;
      event.returnValue = "You pressed backspace.";
      return "You pressed backspace.";
    }
    return null;
  });
}
