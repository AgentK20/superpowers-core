import * as cookies from "js-cookie";
import * as path from "path";
import * as _ from "lodash";

export let languages: { [value: string]: string} = {
  "en": "English",
  "fr": "Français"
};

// Initialize preferred language
let language: string = cookies.get("language");
if (language == null) {
  language = window.navigator.language;
  let separatorIndex = language.indexOf("-");
  if (separatorIndex !== -1) language = language.slice(0, separatorIndex);

  if (languages[language] == null) language = "en";
  cookies.set("language", language);
}

interface File {
  root: string;
  name: string;
}
interface I18nValue { [key: string]: I18nValue|string; }
interface I18nContext { [context: string]: I18nValue; }

let i18nFallbackContexts: I18nContext = {};
let i18nContexts: I18nContext = {};

export function load(files: File[], callback: Function) {
  let filesToLoad = 0;
  let allFilesRequested = false;

  let loadFile = (language: string, file: File, root: I18nContext) => {
    filesToLoad += 1;

    let filePath = path.join(file.root, `locales/${language}`, `${file.name}.json`);

    window.fetch(filePath).then((response) => {
      if (response.status === 404) {
        filesToLoad -= 1;
        if (filesToLoad === 0 && allFilesRequested) callback();
      } else {
        response.json().then((data) => {
          if (root[file.name] == null) root[file.name] = data;
          else root[file.name] = _.merge(root[file.name], data) as any;

          filesToLoad -= 1;
          if (filesToLoad === 0 && allFilesRequested) callback();
        });
      }
    });
  };

  for (let file of files) {
    loadFile(language, file, i18nContexts);
    if (language !== "en") loadFile("en", file, i18nFallbackContexts);
  }
  allFilesRequested = true;
}

export function t(key: string) {
  let [ context, keys ] = key.split(":");
  let keyParts = keys.split(".");

  let locals: any = i18nContexts[context];
  if (locals == null) return fallbackT(key);

  for (let keyPart of keyParts) {
    locals = locals[keyPart];
    if (locals == null) return fallbackT(key);
  }

  return locals;
}

function fallbackT(key: string) {
  let [ context, keys ] = key.split(":");
  let keyParts = keys.split(".");

  let locals: any = i18nFallbackContexts[context];
  if (locals == null) return key;

  for (let keyPart of keyParts) {
    locals = locals[keyPart];
    if (locals == null) return key;
  }

  return locals;
}
