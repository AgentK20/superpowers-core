import * as fs from "fs";
import * as async from "async";

import * as paths from "./paths";
import authMiddleware from "./authenticate";
import ProjectServer from "./ProjectServer";
import RemoteHubClient from "./RemoteHubClient";

export default class ProjectHub {

  globalIO: SocketIO.Server;
  io: SocketIO.Namespace;

  data = {
    projects: null as SupCore.Data.Projects
  };

  serversById: { [serverId: string]: ProjectServer } = {};
  loadingProjectFolderName: string;

  constructor(globalIO: SocketIO.Server, callback: (err: Error) => any) {
    this.globalIO = globalIO;

    let serveProjects = (callback: ErrorCallback) => {
      async.eachSeries(fs.readdirSync(paths.projects), (folderName: string, cb: (err: Error) => any) => {
        if (folderName.indexOf(".") !== -1) { cb(null); return; }
        this.loadingProjectFolderName = folderName;
        this.loadProject(folderName, cb);
      }, (err) => {
        if (err != null) throw err;
        this.loadingProjectFolderName = null;
        callback();
      });
    };

    let setupProjectsList = (callback: Function) => {
      let data: SupCore.Data.ProjectManifestPub[] = [];
      for (let id in this.serversById) data.push(this.serversById[id].data.manifest.pub);

      data.sort(SupCore.Data.Projects.sort);
      this.data.projects = new SupCore.Data.Projects(data);
      callback();
    };

    let serve = (callback: Function) => {
      this.io = this.globalIO.of("/hub");
      this.io.use(authMiddleware);

      this.io.on("connection", this.onAddSocket);
      callback();
    };

    async.waterfall([ serveProjects, setupProjectsList, serve ], callback);
  }

  saveAll(callback: (err: Error) => any) {
    async.each(Object.keys(this.serversById), (id, cb) => {
      this.serversById[id].save(cb);
    }, callback);
  }

  loadProject(folderName: string, callback: (err: Error) => any) {
    let server = new ProjectServer(this.globalIO, folderName, (err) => {
      if (err != null) { callback(err); return; }

      if (this.serversById[server.data.manifest.pub.id] != null) {
        callback(new Error(`There's already a project with this ID: ${server.data.manifest.pub.id} ` +
        `(${server.projectPath} and ${this.serversById[server.data.manifest.pub.id].projectPath})`));
        return;
      }

      this.serversById[server.data.manifest.pub.id] = server;
      callback(null);
    });
  }

  removeRemoteClient(socketId: string) {
    // this.clients.splice ...
  }

  private onAddSocket = (socket: SocketIO.Socket) => {
    /* tslint:disable:no-unused-variable */
    let client = new RemoteHubClient(this, socket);
    // this.clients.push(client);
    /* tslint:enable:no-unused-variable */
  };
}
