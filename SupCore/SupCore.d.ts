/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./ProjectServer.d.ts" />

declare namespace SupCore {
  export function log(message: string): void;

  namespace Data {
    export function hasDuplicateName(id: string, name: string, siblings: Array<{ id: string; name: string; }>): boolean;
    export function ensureUniqueName(id: string, name: string, siblings: Array<{ id: string; name: string; }>): string;

    interface AssetClass { new(id: string, pub: any, server?: ProjectServer): Base.Asset; }
    interface ComponentConfigClass { new(pub: any, sceneAsset?: any): Base.ComponentConfig; create(): any; }
    interface ResourceClass { new(pub: any, server?: ProjectServer): Base.Resource; }

    class Projects extends Base.ListById {
      static sort(a: ProjectManifestPub, b: ProjectManifestPub): number;

      pub: ProjectManifestPub[];
      byId: { [id: string]: ProjectManifestPub; };

      constructor(pub: ProjectManifestPub[]);
      generateProjectId(): string;
    }

    interface ProjectManifestPub {
      id: string;
      name: string;
      description: string;
      system: string;
      formatVersion: number;
    }
    class ProjectManifest extends Base.Hash {
      static currentFormatVersion: number;

      pub: ProjectManifestPub;
      migratedFromFormatVersion: number;

      constructor(pub: ProjectManifestPub);
    }

    interface DiagnosticsItem {
      id: string;
      type: string;
      data: any;
    }

    class Diagnostics extends Base.ListById {
      constructor(pub: DiagnosticsItem[]);
    }

    interface EntryNode {
      id: string;
      name: string;
      children?: EntryNode[];
      [name: string]: any;

      type?: string;
      diagnostics?: DiagnosticsItem[];
      dependentAssetIds?: any[];
    }
    class Entries extends Base.TreeById {
      pub: EntryNode[];
      byId: { [id: string]: EntryNode };

      diagnosticsByEntryId: { [key: string]: Diagnostics };
      dependenciesByAssetId: any;

      constructor(pub: EntryNode[], server?: ProjectServer);
      walk(callback: (node: EntryNode, parentNode?: EntryNode) => any): void;
      add(node: EntryNode, parentId: string, index: number, callback: (err: string, index?: number) => any): void;
      client_add(node: EntryNode, parentId: string, index: number): void;
      move(id: string, parentId: string, index: number, callback: (err: string, index?: number) => any): void;
      remove(id: string, callback: (err: string) => any): void;
      setProperty(id: string, key: string, value: any, callback: (err: string, value?: any) => any): void;
      getForStorage(): EntryNode[];
      getStoragePathFromId(id: string, options?: { includeId: boolean }): string;
    }

    class Assets extends Base.Dictionary {
      server: ProjectServer;

      constructor(server: ProjectServer);
      // _load(id: string): void;
    }
    class Resources extends Base.Dictionary {
      server: ProjectServer;
      resourceClassesById: ProjectServer;

      constructor(server: ProjectServer);
      // _load(id: string): void;
    }

    class Room extends Base.Hash {
      users: RoomUsers;

      constructor(pub: any);
      load(roomPath: string): void;
      unload(): void;
      save(roomPath: string, callback: (err: Error) => any): void;
      join(client: any, callback: (err: string, item?: any, index?: number) => any): void;
      client_join(item: any, index: number): void;
      leave(client: any, callback: (err: string, username?: any) => any): void;
      client_leave(id: string): void;
      server_appendMessage(client: any, text: string, callback: (err: string, entry?: any) => any): void;
      client_appendMessage(entry: any): void;
    }
    class Rooms extends Base.Dictionary {
      server: ProjectServer;

      constructor(server: ProjectServer);
      // _load(id: string): void;

    }
    class RoomUsers extends Base.ListById {
      constructor(pub: any[]);
    }

    namespace Base {
      interface Rule {
        mutable?: boolean;
        type: string;

        // Number
        min?: number;
        minExcluded?: number;
        max?: number;
        maxExcluded?: number;

        // String
        length?: number;
        minLength?: number;
        maxLength?: number;

        // Enum or Array
        items?: string[] | Rule;

        // Hash
        keys?: { length?: number; minLength?: number; maxLength?: number; };
        values?: Rule;
        properties?: { [key: string]: Rule };
      }
      interface Violation {
        message: string; path?: string;
      }

      export function getRuleViolation(value: any, rule: Rule, create: boolean): Violation;
      export function formatRuleViolation(violation: Violation): string;

      class Hash extends EventEmitter {
        pub: any;
        schema: any;

        constructor(pub: any, schema: any);
        setProperty(path: string, value: number|string|boolean, callback: (err: string, value?: any) => any): void;
        client_setProperty(path: string, value: number|string|boolean): void;
      }

      class ListById extends EventEmitter {
        pub: any[];
        schema: any;
        generateNextId: Function;
        nextId: number;

        byId: any;

        constructor(pub: any[], schema: any, generateNextId?: Function);
        add(item: any, index: number, callback: (err: string, index?: number) => any): void;
        client_add(item: any, index: number): void;
        move(id: string, index: number, callback: (err: string, index?: number) => any): void;
        client_move(id: string, newIndex: number): void;
        remove(id: string, callback: (err: string, index?: number) => any): void;
        client_remove(id: string): void;
        setProperty(id: string, key: string, value: number|string|boolean, callback: (err: string, value?: any) => any): void;
        client_setProperty(id: string, key: string, value: number|string|boolean): void;
      }

      interface TreeNode {
        id: string;
        name: string;
        children?: TreeNode[];
        [name: string]: any;
      }
      class TreeById extends EventEmitter {
        pub: TreeNode[];
        schema: any;
        nextId: number;

        byId: { [key: string]: any };
        parentNodesById: { [key: string]: any };

        constructor(pub: TreeNode[], schema: any, nextId?: number);
        walk(callback: (node: TreeNode, parentNode?: TreeNode) => any): void;
        walkNode(node: TreeNode, parentNode: TreeNode, callback: (node: TreeNode, parentNode?: TreeNode) => any): void;
        getPathFromId(id: string): string;
        add(node: TreeNode, parentId: string, index: number, callback: (err: string, index?: number) => any): void;
        client_add(node: TreeNode, parentId: string, index: number): void;
        move(id: string, parentId: string, index: number, callback: (err: string, index?: number) => any): void;
        client_move(id: string, parentId: string, index: number): void;
        remove(id: string, callback: (err: string) => any): void;
        client_remove(id: string): void;
        setProperty(id: string, key: string, value: any, callback: (err: string, value?: any) => any): void;
        client_setProperty(id: string, key: string, value: any): void;
      }

      class Dictionary extends EventEmitter {
        byId: { [key: string]: any; };
        refCountById: { [key: string]: number; };
        unloadDelaySeconds: number;
        unloadTimeoutsById: { [id: string]: number };

        constructor(unloadDelaySeconds: number);
        acquire(id: string, owner: any, callback: (err: Error, item: any) => any): void;
        release(id: string, owner: any, options?: { skipUnloadDelay: boolean }): void;
        // _load(id: string): void;
        // _unload(id: string): void;
        releaseAll(id: string): void;
      }

      interface Schema { [key: string]: Base.Rule; }
      class Asset extends Hash {
        id: string;
        server: ProjectServer;

        constructor(id: string, pub: any, schema: Schema, server: ProjectServer);
        // OVERRIDE: Make sure to call super(callback). Called when creating a new asset
        init(options: any, callback: Function): void;

        // OVERRIDE: Called when creating/loading an asset
        setup(): void;

        // OVERRIDE: Called when loading a project
        // Check for any error/warning/info and this.emit("setDiagnostic", ...) as required
        // Also if the asset depends on others, this.emit("addDependencies", ...) with a list of entry IDs
        restore(): void;

        // OVERRIDE: Called when destroying an asset
        // Most assets won't need to do anything here but some might want to do some
        // clean up work like making changes to associated resources
        destroy(callback: Function): void;

        load(assetPath: string): void;
        _onLoaded(assetPath: string, pub: any): void;
        unload(): void;
        migrate(assetPath: string, pub: any, callback: (hasMigrated: boolean) => void): void;

        client_load(): void;
        client_unload(): void;

        save(assetPath: string, callback: (err: Error) => any): void;

        server_setProperty(client: any, path: string, value: any, callback: (err: string, path?: string, value?: any) => any): void;
      }

      class Resource extends Hash {
        server: ProjectServer;

        constructor(pub: any, schema: Schema, server: ProjectServer);

        // OVERRIDE: Make sure to call super(callback). Called when creating a new resource
        init(callback: Function): void;

        // OVERRIDE: Called when creating/loading a resource
        setup(): void;

        load(resourcePath: string): void;
        _onLoaded(resourcePath: string, pub: any): void;
        unload(): void;
        migrate(resourcePath: string, pub: any, callback: (hasMigrated: boolean) => void): void;
        save(resourcePath: string, callback: (err: Error) => any): void;
        server_setProperty(client: any, path: string, value: number|string|boolean, callback: (err: string, path?: string, value?: any) => any): void;
      }

      class ComponentConfig extends Hash {
        constructor(pub: any, schema: any);

        // OVERRIDE: Called when loading a scene
        // Check for any error/warning/info and this.emit("setDiagnostic", ...) as required
        // Also if the component depends on assets, this.emit("addDependencies", ...) with a list of entry IDs
        restore(): void;

        // OVERRIDE: Called when destroying a component or its actor
        // If the component depends on assets, this.emit("removeDependencies", ...) with a list of entry IDs
        destroy(): void;

        // OVERRIDE: Called when editing a property
        // You can check for asset dependency changes by overriding this method
        // and calling this.emit("addDependencies" / "removeDependencies", ...) as needed
        // setProperty(path, value, callback) {}

        server_setProperty(client: any, path: string, value: number|string|boolean, callback: (err: string, path?: string, value?: any) => any): void;
      }
    }
  }

  interface PluginsInfo {
    list: string[];
    paths: {
      editors: { [assetType: string]: string; };
      tools: { [name: string]: string; };
    };
  }

  interface SystemsInfo {
    list: string[];
  }

  interface APIPlugin {
    code: string;
    defs: string;
    exposeActorComponent?: { propertyName: string; className: string; };
  }

  class SystemAPI {
    contexts: { [contextName: string]: { plugins: { [pluginName: string]: APIPlugin; } } };

    registerPlugin(contextName: string, pluginName: string, plugin: APIPlugin): void;
  }

  class SystemData {
    assetClasses: { [assetName: string]: SupCore.Data.AssetClass; };
    componentConfigClasses: { [componentConfigName: string]: SupCore.Data.ComponentConfigClass; };
    resourceClasses: { [resourceName: string]: SupCore.Data.ResourceClass };

    registerAssetClass(name: string, assetClass: SupCore.Data.AssetClass): void;
    registerComponentConfigClass(name: string, configClass: SupCore.Data.ComponentConfigClass): void;
    // Register a plugin *resource* (see SupCore.Data.Resources), not just a resource class, hence the name
    registerResource(name: string, resourceClass: SupCore.Data.ResourceClass): void;
  }

  class System {
    name: string;
    api: SystemAPI;
    data: SystemData;

    constructor(name: string);
  }

  // All loaded systems (server-side only)
  export let systems: { [system: string]: System };
  // The currently active system
  export let system: System;

  class EventEmitter implements NodeJS.EventEmitter {
    static listenerCount(emitter: EventEmitter, event: string): number;

    addListener(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    once(event: string, listener: Function): EventEmitter;
    removeListener(event: string, listener: Function): EventEmitter;
    removeAllListeners(event?: string): EventEmitter;
    setMaxListeners(n: number): void;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
  }
}
