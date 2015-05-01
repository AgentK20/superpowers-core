import * as SupData from "./index";
import * as path from "path";

// Plugin resources are assets managed by plugins outside the project's asset tree
// They might be used for project-wide plugin-specific settings for instance
export default class Resources extends SupData.base.Dictionary {
  server: any;

  constructor(server: any) {
    super()
    this.server = server;
  }

  acquire(id: string, owner: any, callback: (err: Error, item: any) => any) {
    if (SupData.resourceClasses[id] == null) { callback(new Error(`Invalid resource id: ${id}`), null); return; }

    super.acquire(id, owner, callback);
  }

  _load(id: string) {
    let resourceClass = SupData.resourceClasses[id];

    let resource = new resourceClass(null, this.server.data);
    resource.load(path.join(this.server.projectPath, `resources/${id}`));

    return resource;
  }
}
