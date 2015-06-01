export default function confirm(label: string, validationLabel: string, callback: (value: boolean) => any) {
  let dialogElt = document.createElement("div"); dialogElt.className = "dialog";
  let formElt = document.createElement("form"); dialogElt.appendChild(formElt);

  let labelElt = document.createElement("label");
  labelElt.textContent = label;
  formElt.appendChild(labelElt);
  
  // Buttons
  let buttonsElt = document.createElement("div");
  buttonsElt.className = "buttons";
  formElt.appendChild(buttonsElt);

  let cancelButtonElt = document.createElement("button");
  cancelButtonElt.textContent = "Cancel";
  cancelButtonElt.className = "cancel-button";
  cancelButtonElt.addEventListener("click", closeDialog);

  let validateButtonElt = document.createElement("button");
  validateButtonElt.textContent = validationLabel;
  validateButtonElt.className = "validate-button";

  if (navigator.platform === "Win32") {
    buttonsElt.appendChild(validateButtonElt);
    buttonsElt.appendChild(cancelButtonElt);
  } else {
    buttonsElt.appendChild(cancelButtonElt);
    buttonsElt.appendChild(validateButtonElt);
  }
  
  // Validation and cancellation
  formElt.addEventListener("submit", () => {
    if (! formElt.checkValidity()) return;

    event.preventDefault();
    document.body.removeChild(dialogElt);
    document.removeEventListener("keydown", onKeyDown);
    if (callback != null) callback(true);
  });
  
  function onKeyDown(event: KeyboardEvent) { if (event.keyCode === 27) { event.preventDefault(); closeDialog(); } }
  document.addEventListener("keydown", onKeyDown);
  
  function closeDialog() {
    document.body.removeChild(dialogElt);
    document.removeEventListener("keydown", onKeyDown);
    if (callback != null) callback(false);
  }

  // Show dialog
  document.body.appendChild(dialogElt);
  validateButtonElt.focus();
}
