interface RowParts {
  row: HTMLTableRowElement;
  labelCell: HTMLTableHeaderCellElement;
  valueCell: HTMLTableDataCellElement;
  checkbox?: HTMLInputElement;
}

export function createInput(type: string, parent?: HTMLElement) {
  let input = document.createElement("input");
  input.type = type;
  if (parent != null) parent.appendChild(input);
  return input;
}

export function appendRow(parentTableBody: HTMLTableSectionElement, name: string, options?: { checkbox?: boolean; title?: string; }): RowParts {
  let row = document.createElement("tr");
  parentTableBody.appendChild(row);

  let labelCell = document.createElement("th");
  row.appendChild(labelCell);

  let checkbox: HTMLInputElement;
  if (options != null && options.checkbox) {
    let container = document.createElement("div");
    labelCell.appendChild(container);

    let nameElt = document.createElement("div");
    nameElt.textContent = name;
    nameElt.title = options.title;
    container.appendChild(nameElt);

    checkbox = createInput("checkbox", container);
  }
  else labelCell.textContent = name;

  let valueCell = document.createElement("td");
  row.appendChild(valueCell);

  return { row, labelCell, valueCell, checkbox };
}

export function appendTextField(parent: HTMLTableDataCellElement, value: string): HTMLInputElement {
  let input = createInput("text", parent);
  input.value = value;

  return input;
}

export function appendNumberField(parent: HTMLTableDataCellElement, value: number|string, min?: number|string, max?: number|string): HTMLInputElement {
  let input = createInput("number", parent);
  input.value = <any>value;
  if (min != null) input.min = <any>min;
  if (max != null) input.max = <any>max;

  return input;
}

export function appendBooleanField(parent: HTMLTableDataCellElement, value: boolean): HTMLInputElement {
  let input = createInput("checkbox", parent);
  input.checked = value;

  return input;
}

export function appendSelectBox(parent: HTMLTableDataCellElement, options: { [value: string]: string; }, initialValue=""): HTMLSelectElement {
  let selectInput = document.createElement("select");
  parent.appendChild(selectInput);
  for (let value in options) appendSelectOption(selectInput, value, options[value]);
  selectInput.value = initialValue;

  return selectInput;
}

export function appendSelectOption(parent: HTMLSelectElement, value: string, label: string): HTMLOptionElement {
  let option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  parent.appendChild(option);

  return option;
}
