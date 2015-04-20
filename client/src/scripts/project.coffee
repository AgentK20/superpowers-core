nodeRequire = require
TreeView = require 'dnd-tree-view'
TabStrip = require 'tab-strip'

info = {}
data = null
ui = {}
socket = null

module.exports = (projectId) ->
  info.projectId = projectId

  template = document.getElementById('project-template')
  clone = document.importNode template.content, true
  document.body.appendChild clone

  # Workaround for NW.js bug: https://github.com/nwjs/nw.js/issues/3360
  if navigator.platform == 'MacIntel'
    document.querySelector('.tabs-bar').style.webkitAppRegion = 'no-drag'

  # Hot-keys
  document.addEventListener 'keydown', (event) =>
    if event.keyCode == 78 and (event.ctrlKey or event.metaKey) # Ctrl+N
      event.preventDefault()
      if (event.shiftKey) then onNewFolderClick()
      else onNewAssetClick()

    if event.keyCode == 113 # F2
      event.preventDefault()
      onRenameEntryClick()

    if event.keyCode == 68 and (event.ctrlKey or event.metaKey) # Ctrl+D
      event.preventDefault()
      onDuplicateEntryClick()

    if event.keyCode == 46 # SUPPR
      event.preventDefault()
      onTrashEntryClick()

    if (event.keyCode == 79 or event.keyCode == 80) and (event.ctrlKey or event.metaKey) # Ctrl+O
      event.preventDefault()
      openSearchEntryDialog()

    if event.keyCode == 87 and (event.ctrlKey or event.metaKey) # Ctrl+W
      event.preventDefault()
      onTabClose ui.tabStrip.tabsRoot.querySelector('.active')

    if event.keyCode == 9 and event.ctrlKey # Ctrl+TAB
      event.preventDefault()
      if event.shiftKey then onActivatePreviousTab()
      else onActivateNextTab()

    if event.keyCode == 116 or (event.keyCode == 80 and event.metaKey) # F5 or Cmd+P
      event.preventDefault()
      runGame()

    if event.keyCode == 117 or (event.keyCode == 80 and event.metaKey and event.shiftKey) # F6 or Cmd+Shift+P
      event.preventDefault()
      runGame { debug: true }
    return

  # Project info
  document.querySelector('.project-buttons .run').addEventListener 'click', => runGame()
  document.querySelector('.project-buttons .export').addEventListener 'click', => exportGame()
  document.querySelector('.project-buttons .debug').addEventListener 'click', => runGame { debug: true }
  if ! window.nwDispatcher?
    document.querySelector('.project-buttons .export').title = 'Export game (only works from the Superpowers app for technical reasons)'
    document.querySelector('.project-buttons .debug').style.display = 'none'

  # Entries tree view
  ui.entriesTreeView = new TreeView document.querySelector('.entries-tree-view'), onEntryDrop
  ui.entriesTreeView.on 'selectionChange', updateSelectedEntry
  ui.entriesTreeView.on 'activate', onEntryActivate

  ui.assetsTypeByName = {}
  for assetType, editor of SupClient.pluginPaths.editorsByAssetType
    ui.assetsTypeByName[editor.title.en] = assetType

  document.querySelector('.entries-buttons .new-asset').addEventListener 'click', onNewAssetClick
  document.querySelector('.entries-buttons .new-folder').addEventListener 'click', onNewFolderClick
  document.querySelector('.entries-buttons .search').addEventListener 'click', onSearchClick
  document.querySelector('.entries-buttons .rename-entry').addEventListener 'click', onRenameEntryClick
  document.querySelector('.entries-buttons .duplicate-entry').addEventListener 'click', onDuplicateEntryClick
  document.querySelector('.entries-buttons .trash-entry').addEventListener 'click', onTrashEntryClick

  ui.openInNewWindowButton = document.createElement('button')
  ui.openInNewWindowButton.classList.add 'openInNewWindow'
  ui.openInNewWindowButton.textContent = "[>]"
  ui.openInNewWindowButton.title = "Open in new window"
  ui.openInNewWindowButton.addEventListener 'click', onOpenInNewWindowClick

  # Tab strip
  tabsBarElt = document.querySelector('.tabs-bar')
  ui.tabStrip = new TabStrip tabsBarElt
  ui.tabStrip.on 'activateTab', onTabActivate
  ui.tabStrip.on 'closeTab', onTabClose

  # Prevent <iframe> panes from getting mouse event while dragging tabs
  restorePanesMouseEvent = (event) ->
    ui.panesElt.style.pointerEvents = ''
    document.removeEventListener 'mouseup', restorePanesMouseEvent
    return

  tabsBarElt.addEventListener 'mousedown', (event) ->
    ui.panesElt.style.pointerEvents = 'none'
    document.addEventListener 'mouseup', restorePanesMouseEvent
    return

  # Global controls
  toggleNotificationsButton = document.querySelector('.top .controls button.toggle-notifications')
  toggleNotificationsButton.addEventListener 'click', onClickToggleNotifications

  if localStorage.getItem('disableNotifications')?
    toggleNotificationsButton.classList.add 'disabled'
    toggleNotificationsButton.title = "Click to enable notifications"
  else
    toggleNotificationsButton.classList.remove 'disabled'
    toggleNotificationsButton.title = 'Click to disable notifications'


  # Panes
  ui.panesElt = document.querySelector('.project .main .panes')

  window.addEventListener "message", onMessage

  # Tools and settings
  toolsList = document.querySelector('.sidebar .tools ul')

  for toolName, tool of SupClient.pluginPaths.toolsByName
    if toolName == 'main' and tool.pluginPath == 'sparklinlabs/home'
      openTool toolName
      continue

    toolElt = document.createElement('li')
    toolElt.dataset.name = toolName
    containerElt = document.createElement('div')
    toolElt.appendChild containerElt

    anchorElt = document.createElement('a')
    anchorElt.target = "_blank"
    anchorElt.textContent = tool.title.en
    containerElt.appendChild anchorElt

    toolElt.addEventListener 'mouseenter', (event) => event.target.appendChild ui.openInNewWindowButton; return
    toolElt.addEventListener 'mouseleave', (event) => ui.openInNewWindowButton.parentElement?.removeChild ui.openInNewWindowButton; return
    anchorElt.addEventListener "click", (event) =>
      openTool event.target.parentElement.parentElement.dataset.name
      return
    toolsList.appendChild toolElt

  # Network
  socket = SupClient.connect projectId, { promptCredentials: true, reconnection: true }

  socket.on 'connect', onConnected
  socket.on 'disconnect', onDisconnected

  socket.on 'setProperty:manifest', onSetManifestProperty

  socket.on 'add:entries', onEntryAdded
  socket.on 'move:entries', onEntryMoved
  socket.on 'trash:entries', onEntryTrashed
  socket.on 'setProperty:entries', onSetEntryProperty

  socket.on 'set:diagnostics', onDiagnosticSet
  socket.on 'clear:diagnostics', onDiagnosticCleared

  socket.on 'add:dependencies', onDependenciesAdded
  socket.on 'remove:dependencies', onDependenciesRemoved

  return

# Network callbacks
onConnected = ->
  data = {}
  socket.emit 'sub', 'manifest', null, onManifestReceived
  socket.emit 'sub', 'entries', null, onEntriesReceived
  return

onDisconnected = ->
  data = null
  ui.entriesTreeView.clearSelection()
  ui.entriesTreeView.treeRoot.innerHTML = ''
  updateSelectedEntry()

  document.querySelector('.project-buttons .run').disabled = true
  document.querySelector('.project-buttons .debug').disabled = true
  document.querySelector('.entries-buttons .new-asset').disabled = true
  document.querySelector('.entries-buttons .new-folder').disabled = true
  document.querySelector('.entries-buttons .search').disabled = true
  document.querySelector('.connecting').style.display = ''
  return

onManifestReceived = (err, manifest) ->
  data.manifest = new SupCore.data.Manifest manifest

  document.querySelector('.project .project-name').textContent = manifest.name
  document.title = "#{manifest.name} — Superpowers"
  return

onEntriesReceived = (err, entries) ->
  data.entries = new SupCore.data.Entries entries

  ui.entriesTreeView.clearSelection()
  ui.entriesTreeView.treeRoot.innerHTML = ''

  document.querySelector('.connecting').style.display = 'none'

  if window.nwDispatcher? then document.querySelector('.project-buttons .export').disabled = false
  document.querySelector('.project-buttons .run').disabled = false
  document.querySelector('.project-buttons .debug').disabled = false
  document.querySelector('.entries-buttons .new-asset').disabled = false
  document.querySelector('.entries-buttons .new-folder').disabled = false
  document.querySelector('.entries-buttons .search').disabled = false

  walk = (entry, parentEntry, parentElt) ->
    liElt = createEntryElement entry
    liElt.classList.add "collapsed"

    nodeType = if entry.children? then 'group' else 'item'
    ui.entriesTreeView.append liElt, nodeType, parentElt

    if entry.children?
      walk child, entry, liElt for child in entry.children

    return

  walk entry, null, null for entry in entries
  return

onSetManifestProperty = (key, value) ->
  data.manifest.client_setProperty key, value

  switch key
    when 'name'
      document.querySelector('.project .project-name').textContent = value

  return

onEntryAdded = (entry, parentId, index) ->
  data.entries.client_add entry, parentId, index

  liElt = createEntryElement entry
  nodeType = if entry.children? then 'group' else 'item'

  if parentId?
    parentElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{parentId}']")

  ui.entriesTreeView.insertAt liElt, nodeType, index, parentElt
  return

onEntryAddedAck = (err, id) ->
  if err? then alert err; return

  ui.entriesTreeView.clearSelection()
  ui.entriesTreeView.addToSelection ui.entriesTreeView.treeRoot.querySelector("li[data-id='#{id}']")
  updateSelectedEntry()
  return

onEntryMoved = (id, parentId, index) ->
  data.entries.client_move id, parentId, index

  entryElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{id}']")
  nodeType = if entryElt.classList.contains('group') then 'group' else 'item'

  if parentId?
    parentElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{parentId}']")

  ui.entriesTreeView.insertAt entryElt, nodeType, index, parentElt

  refreshAssetTabElement data.entries.byId[id]
  return

onEntryTrashed = (id) ->
  data.entries.client_remove id

  entryElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{id}']")
  ui.entriesTreeView.remove entryElt
  return

onSetEntryProperty = (id, key, value) ->
  data.entries.client_setProperty id, key, value

  entryElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{id}']")

  switch key
    when 'name'
      entryElt.querySelector('.name').textContent = value
      refreshAssetTabElement data.entries.byId[id]

  return

onDiagnosticSet = (id, newDiag) ->
  diagnostics = data.entries.diagnosticsByEntryId[id]

  existingDiag = diagnostics.byId[newDiag.id]
  if existingDiag?
    existingDiag.type = newDiag.type
    existingDiag.data = newDiag.data
  else
    diagnostics.client_add newDiag

  diagnosticsElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{id}'] .diagnostics")
  diagSpan = document.createElement('span')
  diagSpan.className = newDiag.id
  diagSpan.textContent = newDiag.id
  diagnosticsElt.appendChild diagSpan
  return

onDiagnosticCleared = (id, diagId) ->
  diagnostics = data.entries.diagnosticsByEntryId[id]
  diagnostics.client_remove diagId

  diagElt = ui.entriesTreeView.treeRoot.querySelector("[data-id='#{id}'] .diagnostics .#{diagId}")
  diagElt.parentElement.removeChild diagElt
  return

onDependenciesAdded = (id, depIds) ->
  data.entries.byId[depId].dependentAssetIds.push id for depId in depIds
  return

onDependenciesRemoved = (id, depIds) ->
  for depId in depIds
    dependentAssetIds = data.entries.byId[depId].dependentAssetIds
    dependentAssetIds.splice dependentAssetIds.indexOf(id), 1

  return

# User interface

# Make sure windows have a frame in NW.js
gui = window.nwDispatcher?.requireNwGui()
if gui?
  nwWindow = gui.Window.get()
  nwWindow.on 'new-win-policy', (frame, url, policy) ->
    options =
      min_width: 800, min_height: 480
      width: 1000, height: 600
      toolbar: false, frame: true

    if url.substring(0, 'data:'.length) == 'data:'
      options.width = 800
      options.height = 480

    policy.setNewWindowManifest options
    return

gameWindow = null
runGame = (options={}) ->
  gameWindow.close() if window.nwDispatcher? and gameWindow?
  gameWindow = window.open 'build.html', "player_#{info.projectId}"

  socket.emit 'build:project', (err, buildId) ->
    if err? then alert err; return
    url = "/player?project=#{info.projectId}&build=#{buildId}"
    if options.debug then url += "&debug"

    window.open url, "player_#{info.projectId}"
    return
  return

exportGame = ->
  fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.setAttribute 'nwdirectory', ''
  fileInput.setAttribute 'nwsaveas', ''
  fileInput.click()

  fileInput.addEventListener 'change', (event) ->
    outputFolder = this.value
    isFolderEmpty = false

    fs = nodeRequire 'fs'
    try isFolderEmpty = fs.readdirSync(outputFolder).length == 0
    catch e then alert "Error while checking if folder was empty: #{e.message}"; return
    if ! isFolderEmpty then alert "Output folder must be empty."; return

    playerWindow = window.open 'build.html', 'player'

    socket.emit 'build:project', (err, buildId, files) ->
      playerWindow.postMessage { type: 'save', projectId: info.projectId, buildId, outputFolder, files }, window.location.origin
      return

  return

createEntryElement = (entry) ->
  liElt = document.createElement('li')
  liElt.dataset.id = entry.id

  if entry.type?
    iconElt = document.createElement('img')
    iconElt.src = "/plugins/#{SupClient.pluginPaths.editorsByAssetType[entry.type].pluginPath}/editors/#{entry.type}/icon.svg"
    liElt.appendChild iconElt

  nameSpan = document.createElement('span')
  nameSpan.className = 'name'
  nameSpan.textContent = entry.name
  liElt.appendChild nameSpan

  if entry.type?
    liElt.addEventListener 'mouseenter', (event) -> liElt.appendChild ui.openInNewWindowButton; return
    liElt.addEventListener 'mouseleave', (event) -> ui.openInNewWindowButton.parentElement?.removeChild ui.openInNewWindowButton; return

    diagnosticsSpan = document.createElement('span')
    diagnosticsSpan.className = 'diagnostics'

    for diag in entry.diagnostics
      diagSpan = document.createElement('span')
      diagSpan.className = diag.id
      diagSpan.textContent = diag.id
      diagnosticsSpan.appendChild diagSpan

    liElt.appendChild diagnosticsSpan

  liElt

onEntryDrop = (dropInfo, orderedNodes) ->
  { parentId, index } = SupClient.getTreeViewDropPoint dropInfo, data.entries

  entryIds = ( entry.dataset.id for entry in orderedNodes )

  sourceParentNode = data.entries.parentNodesById[entryIds[0]]
  sourceChildren = sourceParentNode?.children ? data.entries.pub
  sameParent = parentId == sourceParentNode?.id

  i = 0
  for id in entryIds
    socket.emit 'move:entries', id, parentId, index + i, (err) -> if err? then alert err; return
    if ! sameParent or sourceChildren.indexOf(data.entries.byId[id]) >= index then i++

  false

updateSelectedEntry = ->
  for button in document.querySelectorAll('.entries-buttons button.edit')
    disabled = ui.entriesTreeView.selectedNodes.length == 0 or
      (button.classList.contains('single') and ui.entriesTreeView.selectedNodes.length != 1) or
      (button.classList.contains('asset-only') and ui.entriesTreeView.selectedNodes[0].classList.contains('group'))

    button.disabled = disabled

  return

onEntryActivate = ->
  activatedEntry = ui.entriesTreeView.selectedNodes[0]
  openEntry activatedEntry.dataset.id
  return

onMessage = (event) ->
  if event.data.type == "chat" then onMessageChat event.data.content
  if event.data.type == "hotkey" then onMessageHotKey event.data.content

  return

onMessageChat = (message) ->
  isHomeTabVisible = ui.homeTab.classList.contains('active')
  return if isHomeTabVisible and ! document.hidden

  if ! isHomeTabVisible then ui.homeTab.classList.add 'blink'

  return if localStorage.getItem('disableNotifications')?

  doNotification = =>
    notification = new Notification "New chat message in \"#{data.manifest.pub.name}\" project",
      icon: "/images/icon.png", body: message

    closeTimeoutId = setTimeout ( => notification.close(); return ), 5000

    notification.addEventListener 'click', =>
      window.focus()
      onTabActivate ui.homeTab
      clearTimeout closeTimeoutId
      notification.close()
      return
    return

  if Notification.permission == 'granted'
    doNotification()
  else if Notification.permission != 'denied'
    Notification.requestPermission (status) =>
      Notification.permission = status
      if Notification.permission == 'granted'
        doNotification()
      return
  return

onMessageHotKey = (action) =>
  switch action
    when 'newAsset'    then onNewAssetClick()
    when 'newFolder'   then onNewFolderClick()
    when 'searchEntry' then openSearchEntryDialog()
    when 'closeTab'    then onTabClose ui.tabStrip.tabsRoot.querySelector('.active')
    when 'previousTab' then onActivatePreviousTab()
    when 'nextTab'     then onActivateNextTab()
    when 'run'         then runGame()
    when 'debug'       then runGame { debug: true }
  return

onClickToggleNotifications = (event) ->
  disableNotifications = localStorage.getItem('disableNotifications') ? false
  disableNotifications = ! disableNotifications

  if ! disableNotifications
    localStorage.removeItem('disableNotifications')
    event.target.classList.remove 'disabled'
    event.target.title = 'Click to disable notifications'
  else
    localStorage.setItem('disableNotifications', 'true')
    event.target.classList.add 'disabled'
    event.target.title = 'Click to enable notifications'
  return

openSearchEntryDialog = ->
  entries = []
  data.entries.walk (node) =>
    entries.push data.entries.getPathFromId node.id if node.type?
    return

  SupClient.dialogs.filter entries, "Asset Name", (entryPath) =>
    return if ! entryPath?
    openEntry SupClient.findEntryByPath(data.entries.pub, entryPath).id
    return

openEntry = (id) ->
  entry = data.entries.byId[id]

  # Just toggle folders
  if ! entry.type? then ui.entriesTreeView.selectedNodes[0].classList.toggle 'collapsed'; return

  tab = ui.tabStrip.tabsRoot.querySelector("li[data-asset-id='#{id}']")
  iframe = ui.panesElt.querySelector("iframe[data-asset-id='#{id}']")

  if ! tab?
    tab = createAssetTabElement entry
    ui.tabStrip.tabsRoot.appendChild tab

    iframe = document.createElement('iframe')
    iframe.src = "/plugins/#{SupClient.pluginPaths.editorsByAssetType[entry.type].pluginPath}/editors/#{entry.type}/?project=#{info.projectId}&asset=#{id}"
    iframe.dataset.assetId = id
    ui.panesElt.appendChild iframe

  onTabActivate tab
  return

openTool = (name) ->
  tab = ui.tabStrip.tabsRoot.querySelector("li[data-pane='#{name}']")
  iframe = ui.panesElt.querySelector("iframe[data-name='#{name}']")

  if ! tab?
    tool = SupClient.pluginPaths.toolsByName[name]
    tab = createToolTabElement name, tool
    ui.tabStrip.tabsRoot.appendChild tab

    iframe = document.createElement('iframe')
    iframe.src = "/plugins/#{tool.pluginPath}/editors/#{name}/?project=#{info.projectId}"
    iframe.dataset.name = name
    ui.panesElt.appendChild iframe

  onTabActivate tab
  return

onNewAssetClick = ->
  SupClient.dialogs.prompt "Enter a name for the new asset.", "Asset name", null, "Create", (name) =>
    return if ! name?

    SupClient.dialogs.select "Choose a type for the new asset.", ui.assetsTypeByName, "Create", (type) =>
      return if ! type?

      socket.emit 'add:entries', name, type, SupClient.getTreeViewInsertionPoint(ui.entriesTreeView), onEntryAddedAck
    return
  return

onNewFolderClick = ->
  SupClient.dialogs.prompt "Enter a name for the new folder.", "Enter a name", null, "Create", (name) =>
    return if ! name?

    socket.emit 'add:entries', name, null, SupClient.getTreeViewInsertionPoint(ui.entriesTreeView), onEntryAddedAck
    return
  return

onSearchClick = ->
  openSearchEntryDialog()
  return

onTrashEntryClick = ->
  return if ui.entriesTreeView.selectedNodes.length == 0

  selectedEntries = []

  checkNextEntry = =>
    selectedEntries.splice(0, 1)
    if selectedEntries.length == 0
      SupClient.dialogs.confirm "Are you sure you want to trash the selected entries?", "Trash", (confirm) =>
        return if ! confirm

        trashEntry = (entry) =>
          if ! entry.type?
            trashEntry entryChild for entryChild in entry.children

          socket.emit 'trash:entries', entry.id, (err) ->
            alert err if err?
            return

        for selectedNode in ui.entriesTreeView.selectedNodes
          entry = data.entries.byId[selectedNode.dataset.id]
          trashEntry entry

        ui.entriesTreeView.clearSelection()
        return

    else
      warnBrokenDependence selectedEntries[0]
    return

  warnBrokenDependence = (entry) =>
    if ! entry.type?
      selectedEntries.push entryChild for entryChild in entry.children

    if entry.dependentAssetIds?.length > 0
      dependentAssetNames = ( data.entries.byId[usingId].name for usingId in entry.dependentAssetIds )
      SupClient.dialogs.info "#{entry.name} is used in #{dependentAssetNames.join(', ')}.", "Close", =>
        checkNextEntry()
        return
    else
      checkNextEntry()

  for selectedNode in ui.entriesTreeView.selectedNodes
    selectedEntries.push data.entries.byId[selectedNode.dataset.id]
  warnBrokenDependence selectedEntries[0]
  return

onOpenInNewWindowClick = (event) ->
  id = event.target.parentElement.dataset.id
  if id?
    entry = data.entries.byId[id]
    window.open "#{window.location.origin}/plugins/#{SupClient.pluginPaths.editorsByAssetType[entry.type].pluginPath}/editors/#{entry.type}/?project=#{info.projectId}&asset=#{entry.id}"
  else
    name = event.target.parentElement.dataset.name
    tool = SupClient.pluginPaths.toolsByName[name]
    window.open "#{window.location.origin}/plugins/#{SupClient.pluginPaths.toolsByName[name].pluginPath}/editors/#{name}/?project=#{info.projectId}"
  return

onRenameEntryClick = ->
  return if ui.entriesTreeView.selectedNodes.length != 1

  selectedNode = ui.entriesTreeView.selectedNodes[0]
  entry = data.entries.byId[selectedNode.dataset.id]

  SupClient.dialogs.prompt "Enter a new name for the asset.", null, entry.name, "Rename", (newName) =>
    return if ! newName? or newName == entry.name

    socket.emit 'setProperty:entries', entry.id, 'name', newName, (err) ->
      alert err if err?
      return
    return
  return

onDuplicateEntryClick = ->
  return if ui.entriesTreeView.selectedNodes.length != 1

  selectedNode = ui.entriesTreeView.selectedNodes[0]
  entry = data.entries.byId[selectedNode.dataset.id]
  return if ! entry.type?

  SupClient.dialogs.prompt "Enter a name for the new asset.", null, entry.name, "Duplicate", (newName) =>
    return if ! newName?

    socket.emit 'duplicate:entries', newName, entry.id, SupClient.getTreeViewInsertionPoint(ui.entriesTreeView), onEntryAddedAck
    return
  return

refreshAssetTabElement = (entry) ->
  tabElt = ui.tabStrip.tabsRoot.querySelector("[data-asset-id='#{entry.id}']")
  return if ! tabElt?

  tabElt.querySelector('.label').textContent = entry.name
  tabElt.title = data.entries.getPathFromId entry.id
  return

createAssetTabElement = (entry) =>
  tabElt = document.createElement('li')

  if entry.type?
    iconElt = document.createElement('img')
    iconElt.classList.add 'icon'
    iconElt.src = "/plugins/#{SupClient.pluginPaths.editorsByAssetType[entry.type].pluginPath}/editors/#{entry.type}/icon.svg"
    tabElt.appendChild iconElt

  tabLabel = document.createElement('span')
  tabLabel.classList.add 'label'
  tabLabel.textContent = entry.name
  tabElt.appendChild tabLabel

  closeButton = document.createElement('button')
  closeButton.classList.add 'close'
  closeButton.addEventListener 'click', => onTabClose tabElt; return
  tabElt.appendChild closeButton

  tabElt.title = data.entries.getPathFromId entry.id
  tabElt.dataset.assetId = entry.id
  tabElt

createToolTabElement = (toolName, tool) =>
  tabElt = document.createElement('li')

  iconElt = document.createElement('img')
  iconElt.classList.add 'icon'
  iconElt.src = "/plugins/#{tool.pluginPath}/editors/#{toolName}/icon.svg"
  tabElt.appendChild iconElt

  tabLabel = document.createElement('span')
  tabLabel.classList.add 'label'
  tabElt.appendChild tabLabel

  if toolName != "main"
    tabLabel.textContent = tool.title.en

    closeButton = document.createElement('button')
    closeButton.classList.add 'close'
    closeButton.addEventListener 'click', => onTabClose tabElt; return
    tabElt.appendChild closeButton

  tabElt.dataset.pane = toolName
  tabElt

onTabActivate = (tabElement) =>
  activeTab = ui.tabStrip.tabsRoot.querySelector('.active')
  if activeTab != null
    activeTab.classList.remove 'active'
    ui.panesElt.querySelector('iframe.active').classList.remove 'active'

  tabElement.classList.add 'active'
  tabElement.classList.remove 'blink'

  assetId = tabElement.dataset.assetId
  if assetId?
    tabIframe = ui.panesElt.querySelector("iframe[data-asset-id='#{assetId}']")
  else
    tabIframe = ui.panesElt.querySelector("iframe[data-name='#{tabElement.dataset.pane}']")

  tabIframe.classList.add 'active'
  tabIframe.contentWindow.focus()
  tabIframe.contentWindow.postMessage { type: "activate" }, window.location.origin
  return

onTabClose = (tabElement) =>
  if tabElement.classList.contains 'active'
    activeTabElement = tabElement.nextSibling ? tabElement.previousSibling
    onTabActivate activeTabElement

  assetId = tabElement.dataset.assetId
  if assetId?
    frameElt = ui.panesElt.querySelector("iframe[data-asset-id='#{assetId}']")
  else
    frameElt = ui.panesElt.querySelector("iframe[data-name='#{tabElement.dataset.pane}']")

  tabElement.parentElement.removeChild tabElement
  frameElt.parentElement.removeChild frameElt
  return

onActivatePreviousTab = ->
  activeTabElt = ui.tabStrip.tabsRoot.querySelector('.active')
  for tabElt, tabIndex in ui.tabStrip.tabsRoot.children
    if tabElt == activeTabElt
      newTabIndex = if tabIndex == 0 then ui.tabStrip.tabsRoot.children.length - 1 else tabIndex - 1
      onTabActivate ui.tabStrip.tabsRoot.children[newTabIndex]
      return
  return

onActivateNextTab = ->
  activeTabElt = ui.tabStrip.tabsRoot.querySelector('.active')
  for tabElt, tabIndex in ui.tabStrip.tabsRoot.children
    if tabElt == activeTabElt
      newTabIndex = if tabIndex == ui.tabStrip.tabsRoot.children.length - 1 then 0 else tabIndex + 1
      onTabActivate ui.tabStrip.tabsRoot.children[newTabIndex]
      return
  return
