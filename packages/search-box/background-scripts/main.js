// NOTE(philc): This file has many superfluous return statements in its functions, as a result of
// converting from coffeescript to es6. Many can be removed, but I didn't take the time to diligently
// track down precisely which return statements could be removed when I was doing the conversion.
/*eslint-disable */
let showUpgradeMessage;

// 安装完成时为当前打开的窗口添加content-script
chrome.runtime.onInstalled.addListener(function ({ reason }) { 
  if ([ "chrome_update", "shared_module_update" ].includes(reason)) { return; }
  if (Utils.isFirefox()) { return; }
  if(!chrome.runtime.getManifest) { return }
  const manifest = chrome.runtime.getManifest(); 
  const contentScripts = manifest.content_scripts[0];
  const jobs = [ [ chrome.tabs.executeScript, contentScripts.js ], [ chrome.tabs.insertCSS, contentScripts.css ] ]; 
  const checkLastRuntimeError = () => chrome.runtime.lastError;
  return chrome.tabs.query({ status: "complete" }, function (tabs) {
    for (let tab of tabs) {
      for (let [ func, files ] of jobs) {
        for (let file of files) { func(tab.id, { file, allFrames: contentScripts.all_frames }, checkLastRuntimeError); } 
      } 
    }
  });
});

const frameIdsForTab = {};
global.portsForTab = {};
global.urlForTab = {};

// This is exported for use by "marks.js".
global.tabLoadedHandlers = {}; // tabId -> function()

// 设置存储
chrome.storage.local.set({vimiumSecret: Math.floor(Math.random() * 2000000000)});

// 数据源集合
const completionSources = { 
  docs: new DocCompleter(),
  frames: new FrameCompleter(),
  bookmarks: new BookmarkCompleter(),
  csdn: new CSDNCompleter(),  
  history: new HistoryCompleter(),
  tabs: new TabCompleter(),
  utils: new UtilsCompleter(),
  searchEngines: new SearchEngineCompleter(),
  // // domains: new DomainCompleter(),
};

const completers = { 
  omni: new MultiCompleter([  
    completionSources.docs,
    completionSources.frames,
    completionSources.utils,
    completionSources.bookmarks,
    completionSources.csdn,  
    completionSources.history,
    completionSources.tabs,
    completionSources.searchEngines,
    // // completionSources.domains,
  ]),
  bookmarks: new MultiCompleter([completionSources.bookmarks]),
  tabs: new MultiCompleter([completionSources.tabs])
};

const completionHandlers = {
  filter (completer, request, port) {
    // TODO(philc): Do we need any of these return statements?
    return completer.filter(request, function (response) {
      // NOTE(smblott): response contains `relevancyFunction` (function) properties which cause postMessage,
      // below, to fail in Firefox. See #2576.  We cannot simply delete these methods, as they're needed
      // elsewhere.  Converting the response to JSON and back is a quick and easy way to sanitize the object.
      response = JSON.parse(JSON.stringify(response));
      // We use try here because this may fail if the sender has already navigated away from the original page.
      // This can happen, for example, when posting completion suggestions from the SearchEngineCompleter
      // (which is done asynchronously).
      try {
        return port.postMessage(Object.assign(request, response, {handler: "completions"}));
      } catch (error) {}
    });
  },

  refresh (completer, _, port) { completer.refresh(port); },
  cancel (completer, _, port) { completer.cancel(port); }
};

const handleCompletions = sender => (request, port) => {
  // console.log(request)
  return completionHandlers[request.handler](completers[request.name], request, port);
}

// 两种情况，1.来自search-box/index.html(completions) 2.来自tab页的content-script (frames)
chrome.runtime.onConnect.addListener(function (port) {
  if (Settings.debug) {
    console.log("接收到onConnect链接", port)
  }
  if (portHandlers[port.name]) { return port.onMessage.addListener(portHandlers[port.name](port.sender, port)); }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) { 
  if (Settings.debug) {
    console.log("接收到onConnect链接", request)
  }
  request = Object.assign({count: 1, frameId: sender.frameId},
    request,
    {tab: sender.tab, tabId: sender.tab.id}); 
  if (sendRequestHandlers[request.handler]) {
    sendResponse(sendRequestHandlers[request.handler](request, sender));
  }
  // Ensure that the sendResponse callback is freed.
  return false;
});

const onURLChange = details => chrome.tabs.sendMessage(details.tabId, {name: "checkEnabledAfterURLChange"});
 
chrome.webNavigation.onHistoryStateUpdated.addListener(onURLChange); // history.pushState.
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onURLChange); // Hash changed.

// 缓存css，mainfest中也进行了配置。firefox和chrome加载策略不一致。故background做缓存
(function () {
  const req = new XMLHttpRequest();
  req.open("GET", chrome.runtime.getURL("packages/search-box/content-scripts/searchIframe.css"), true); // true -> asynchronous.
  req.onload = function () {
    const {status, responseText} = req;

    if (status === 200) { return chrome.storage.local.set({vimiumCSSInChromeStorage: responseText}); }
  };
  return req.send();
})();
;

const TabOperations = {
  // Opens the url in the current tab.
  openUrlInCurrentTab (request) {
    if (Utils.hasJavascriptPrefix(request.url)) {
      const tabId = request.tabId;
      const frameId = request.frameId;
      chrome.tabs.sendMessage(tabId, {frameId, name: "executeScript", script: request.url});
    } else {
      chrome.tabs.update(request.tabId, {url: Utils.convertToUrl(request.url)});
    }
  },

  // Opens request.url in new tab and switches to it.
  openUrlInNewTab (request, callback) {
    if (callback == null) { callback = function () {}; }
    const tabConfig = {
      url: Utils.convertToUrl(request.url),
      active: true,
      windowId: request.tab.windowId
    };

    const position = request.position;

    let tabIndex = null;

    // TODO(philc): Convert to a switch statement ES6.
    switch (position) {
      case "start": tabIndex = 0; break;
      case "before": tabIndex = request.tab.index; break;
      // if on Chrome or on Firefox but without openerTabId, `tabs.create` opens a tab at the end.
      // but on Firefox and with openerTabId, it opens a new tab next to the opener tab
      case "end": tabIndex = (Utils.isFirefox() ? 9999 : null); break;
      // "after" is the default case when there are no options.
      default: tabIndex = request.tab.index + 1;
    }
    tabConfig.index = tabIndex;

    if (request.active != null) { tabConfig.active = request.active; }
    // Firefox does not support "about:newtab" in chrome.tabs.create.
    if (tabConfig["url"] === Settings.defaults.newTabUrl) { delete tabConfig["url"]; }

    // Firefox <57 throws an error when openerTabId is used (issue 1238314).
    const canUseOpenerTabId = !(Utils.isFirefox() && (Utils.compareVersions(Utils.firefoxVersion(), "57") < 0));
    if (canUseOpenerTabId) { tabConfig.openerTabId = request.tab.id; }

    // clean position and active, so following `openUrlInNewTab(request)` will create a tab just next to this new tab
    return chrome.tabs.create(tabConfig, tab =>
      callback(Object.assign(request, {tab, tabId: tab.id, position: "", active: false})));
  },

  // Opens request.url in new window and switches to it.
  openUrlInNewWindow (request, callback) {
    if (callback == null) { callback = function () {}; }
    const winConfig = {
      url: Utils.convertToUrl(request.url),
      active: true
    };
    if (request.active != null) { winConfig.active = request.active; }
    // Firefox does not support "about:newtab" in chrome.tabs.create.
    if (winConfig["url"] === Settings.defaults.newTabUrl) { delete winConfig["url"]; }
    return chrome.windows.create(winConfig, callback);
  }
};

const muteTab = tab => chrome.tabs.update(tab.id, {muted: !tab.mutedInfo.muted});
const toggleMuteTab = function ({tab: currentTab, registryEntry, tabId, frameId}) {
  if ((registryEntry.options.all != null) || (registryEntry.options.other != null)) {
    // If there are any audible, unmuted tabs, then we mute them; otherwise we unmute any muted tabs.
    chrome.tabs.query({audible: true}, function (tabs) {
      let tab;
      if (registryEntry.options.other != null) { tabs = tabs.filter(t => t.id !== currentTab.id); }
      const audibleUnmutedTabs = tabs.filter(t => t.audible && !t.mutedInfo.muted);
      if (audibleUnmutedTabs.length >= 0) {
        chrome.tabs.sendMessage(tabId, {frameId, name: "showMessage", message: `Muting ${audibleUnmutedTabs.length} tab(s).`});
        for (tab of audibleUnmutedTabs) { muteTab(tab); }
      } else {
        chrome.tabs.sendMessage(tabId, {frameId, name: "showMessage", message: "Unmuting all muted tabs."});
        for (tab of tabs) {
          if (tab.mutedInfo.muted) { muteTab(tab); } 
        }
      }
    });
  } else {
    if (currentTab.mutedInfo.muted) { chrome.tabs.sendMessage(tabId, {frameId, name: "showMessage", message: "Unmuted tab."}); } else { chrome.tabs.sendMessage(tabId, {frameId, name: "showMessage", message: "Muted tab."}); }
    muteTab(currentTab);
  }
};

//
// Selects the tab with the ID specified in request.id
//
const selectSpecificTab = request => chrome.tabs.get(request.id, function (tab) {
  if (chrome.windows != null) { chrome.windows.update(tab.windowId, { focused: true }); }
  return chrome.tabs.update(request.id, { active: true });
});

const moveTab = function ({count, tab, registryEntry}) {
  if (registryEntry.command === "moveTabLeft") { count = -count; }
  return chrome.tabs.query({ currentWindow: true }, function (tabs) {
    const pinnedCount = (tabs.filter(tab => tab.pinned)).length;
    const minIndex = tab.pinned ? 0 : pinnedCount;
    const maxIndex = (tab.pinned ? pinnedCount : tabs.length) - 1;
    return chrome.tabs.move(tab.id,
      {index: Math.max(minIndex, Math.min(maxIndex, tab.index + count))});
  });
};

var mkRepeatCommand = command => function (request) {
  request.count--;
  if (request.count >= 0) { return command(request, request => (mkRepeatCommand(command))(request)); }
};

// These are commands which are bound to keystrokes which must be handled by the background page. They are
// mapped in commands.coffee.
const BackgroundCommands = {
  // Create a new tab.  Also, with:
  //     map X createTab http://www.bbc.com/news
  // create a new tab with the given URL.
  createTab: mkRepeatCommand(function (request, callback) {
    if (request.urls == null) {
      if (request.url) {
        // If the request contains a URL, then use it.
        request.urls = [request.url];
      } else {
        // Otherwise, if we have a registryEntry containing URLs, then use them.
        const urlList = request.registryEntry.optionList.filter(opt => Utils.isUrl(opt));
        if (urlList.length > 0) {
          request.urls = urlList;
        } else {
          // Otherwise, just create a new tab.
          const newTabUrl = Settings.get("newTabUrl");
          if (newTabUrl === "pages/blank.html") {
            // "pages/blank.html" does not work in incognito mode, so fall back to "chrome://newtab" instead.
            request.urls = [request.tab.incognito ? "chrome://newtab" : chrome.runtime.getURL(newTabUrl)];
          } else {
            request.urls = [newTabUrl];
          }
        }
      }
    }

    if (request.registryEntry.options.incognito || request.registryEntry.options.window) {
      const windowConfig = {
        url: request.urls,
        incognito: request.registryEntry.options.incognito || false
      };
      return chrome.windows.create(windowConfig, () => callback(request));
    } else {
      let openNextUrl;
      const urls = request.urls.slice().reverse();
      if (request.position == null) { request.position = request.registryEntry.options.position; }
      return (openNextUrl = function (request) {
        if (urls.length > 0) { return TabOperations.openUrlInNewTab((Object.assign(request, {url: urls.pop()})), openNextUrl); } else { return callback(request); }
      })(request);
    }
  }),

  duplicateTab: mkRepeatCommand((request, callback) => {
    return chrome.tabs.duplicate(request.tabId,
      tab => callback(Object.assign(request, {tab, tabId: tab.id})))
  }),

  moveTabToNewWindow ({count, tab}) {
    chrome.tabs.query({currentWindow: true}, function (tabs) {
      const activeTabIndex = tab.index;
      const startTabIndex = Math.max(0, Math.min(activeTabIndex, tabs.length - count));
      [ tab, ...tabs ] = tabs.slice(startTabIndex, startTabIndex + count);
      chrome.windows.create({tabId: tab.id, incognito: tab.incognito}, function (window) {
        chrome.tabs.move(tabs.map(t => t.id), {windowId: window.id, index: -1});
      });
    });
  },
 
  removeTab ({count, tab}) { return forCountTabs(count, tab, tab => chrome.tabs.remove(tab.id)); },
  restoreTab: mkRepeatCommand((request, callback) => chrome.sessions.restore(null, callback(request))),
  togglePinTab ({count, tab}) { return forCountTabs(count, tab, tab => chrome.tabs.update(tab.id, {pinned: !tab.pinned})); },
  toggleMuteTab,
  moveTabLeft: moveTab,
  moveTabRight: moveTab,

  nextFrame ({count, frameId, tabId}) {
    frameIdsForTab[tabId] = cycleToFrame(frameIdsForTab[tabId], frameId, count);
    return chrome.tabs.sendMessage(tabId, {name: "focusFrame", frameId: frameIdsForTab[tabId][0], highlight: true});
  },

  closeTabsOnLeft (request) { return removeTabsRelative("before", request); },
  closeTabsOnRight (request) { return removeTabsRelative("after", request); },
  closeOtherTabs (request) { return removeTabsRelative("both", request); },

  visitPreviousTab ({count, tab}) {
    const tabIds = BgUtils.tabRecency.getTabsByRecency().filter(tabId => tabId !== tab.id);
    if (tabIds.length > 0) { return selectSpecificTab({id: tabIds[(count - 1) % tabIds.length]}); }
  },

  reload ({count, tabId, registryEntry, tab: {windowId}}) {
    const bypassCache = registryEntry.options.hard != null ? registryEntry.options.hard : false;
    return chrome.tabs.query({windowId}, function (tabs) {
      const position = (function () {
        for (let index = 0; index < tabs.length; index++) {
          const tab = tabs[index];
          if (tab.id === tabId) { return index; }
        }
      })();
      tabs = [...tabs.slice(position), ...tabs.slice(0, position)];
      count = Math.min(count, tabs.length);
      for (let tab of tabs.slice(0, count)) {
        chrome.tabs.reload(tab.id, {bypassCache});
      }
    });
  }
};

var forCountTabs = (count, currentTab, callback) => chrome.tabs.query({currentWindow: true}, function (tabs) {
  const activeTabIndex = currentTab.index;
  const startTabIndex = Math.max(0, Math.min(activeTabIndex, tabs.length - count));
  for (let tab of tabs.slice(startTabIndex, startTabIndex + count)) { callback(tab); }
});

// Remove tabs before, after, or either side of the currently active tab
var removeTabsRelative = (direction, {tab: activeTab}) => chrome.tabs.query({currentWindow: true}, function (tabs) {
  const shouldDelete =
    (() => {
      switch (direction) {
        case "before":
          return index => index < activeTab.index;
        case "after":
          return index => index > activeTab.index;
        case "both":
          return index => index !== activeTab.index;
      } 
    })();

  chrome.tabs.remove(tabs.filter(t => !t.pinned && shouldDelete(t.index))
    .map((t) => t.id));
});

chrome.webNavigation.onCommitted.addListener(function ({tabId, frameId}) {
  const cssConf = {
    frameId,
    code: Settings.get("userDefinedLinkHintCss"),
    runAt: "document_start"
  };
  return chrome.tabs.insertCSS(tabId, cssConf, () => chrome.runtime.lastError);
});
 
var Frames = {
  onConnect (sender, port) {
    const [tabId, frameId] = [sender.tab.id, sender.frameId];
    port.onDisconnect.addListener(() => Frames.unregisterFrame({tabId, frameId, port}));
    port.postMessage({handler: "registerFrameId", chromeFrameId: frameId});
    (portsForTab[tabId] != null ? portsForTab[tabId] : (portsForTab[tabId] = {}))[frameId] = port;

    // Return our onMessage handler for this port.
    return (request, port) => { 
      return this[request.handler]({request, tabId, frameId, port, sender});
    };
  },

  registerFrame ({tabId, frameId, port}) {
    frameIdsForTab[tabId] = frameIdsForTab[tabId] || [];
    if (!frameIdsForTab[tabId].includes(frameId)) {
      frameIdsForTab[tabId].push(frameId);
    }
    portsForTab[tabId] = portsForTab[tabId] || {};
    return portsForTab[tabId][frameId] = port;
  },

  unregisterFrame ({tabId, frameId, port}) {
    // Check that the port trying to unregister the frame hasn't already been replaced by a new frame
    // registering. See #2125.
    const registeredPort = portsForTab[tabId] != null ? portsForTab[tabId][frameId] : undefined;
    if ((registeredPort === port) || !registeredPort) {
      if (tabId in frameIdsForTab) { frameIdsForTab[tabId] = frameIdsForTab[tabId].filter((fId) => fId !== frameId); }
      if (tabId in portsForTab) { delete portsForTab[tabId][frameId]; }
    } 
  },

  isEnabledForUrl ({request, tabId, port}) {
    if (request.frameIsFocused) { urlForTab[tabId] = request.url; }
    request.isFirefox = Utils.isFirefox(); // Update the value for Utils.isFirefox in the frontend.
    const enabledState = Exclusions.isEnabledForUrl(request.url);

    if (request.frameIsFocused) {
     
    }

    return port.postMessage(Object.assign(request, enabledState));
  },

  domReady ({tabId, frameId}) {
    if (frameId == 0) {
      if (tabLoadedHandlers[tabId]) { tabLoadedHandlers[tabId](); }
      delete tabLoadedHandlers[tabId];
    }
  },
  log ({frameId, sender, request: {message}}) {
    BgUtils.log(`${frameId} ${message}`, sender);
  }
};

const handleFrameFocused = function ({tabId, frameId}) {
  if (frameIdsForTab[tabId] == null) { frameIdsForTab[tabId] = []; }
  frameIdsForTab[tabId] = cycleToFrame(frameIdsForTab[tabId], frameId);
  // Inform all frames that a frame has received the focus.
  return chrome.tabs.sendMessage(tabId, {name: "frameFocused", focusFrameId: frameId});
};

// Rotate through frames to the frame count places after frameId.
var cycleToFrame = function (frames, frameId, count) {
  // We can't always track which frame chrome has focused, but here we learn that it's frameId; so add an
  // additional offset such that we do indeed start from frameId.
  if (count == null) { count = 0; }
  count = (count + Math.max(0, frames.indexOf(frameId))) % frames.length;
  return [...frames.slice(count), ...frames.slice(0, count)];
};
 
// Port handler mapping
var portHandlers = {
  completions: handleCompletions,
  frames: Frames.onConnect.bind(Frames)
};

var RondomPass = function (number) { 
  var arr = [];
  var arr1 = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
  
  for (var i = 0; i < number; i++) {
    var n = Math.floor(Math.random() * 10);
    arr[i] = arr1[n]; 
  }  
  return arr.join("");     
} 
 
var sendRequestHandlers = {
  runBackgroundCommand (request) { return BackgroundCommands[request.registryEntry.command](request); },
  // getCurrentTabUrl is used by the content scripts to get their full URL, because window.location cannot help
  // with Chrome-specific URLs like "view-source:http:..".
  getCurrentTabUrl ({tab}) { return tab.url; },
  openUrlInNewTab: mkRepeatCommand((request, callback) => TabOperations.openUrlInNewTab(request, callback)),
  openUrlInNewWindow (request) { return TabOperations.openUrlInNewWindow(request); },
  openUrlInIncognito (request) { return chrome.windows.create({incognito: true, url: Utils.convertToUrl(request.url)}); },
  openUrlInCurrentTab: TabOperations.openUrlInCurrentTab,
  openOptionsPageInNewTab (request) {
    // return chrome.tabs.create({url: chrome.runtime.getURL("pages/options.html"), index: request.tab.index + 1});
  },
  frameFocused: handleFrameFocused,
  nextFrame: BackgroundCommands.nextFrame,
  selectSpecificTab,  
  sendMessageToFrames (request, sender) { return chrome.tabs.sendMessage(sender.tab.id, request.message); },
  sendAjaxRequest (request) {
    chrome.storage.local.get("installUUID", function (items) { 
      // request.message
      let data = request.message
      if (data.data.hasOwnProperty('__logs__')) {
        data.data['__logs__'] = data.data['__logs__'].map(v => Object.assign(v, { cid: items.installUUID }))
      } else {
        data = Object.assign(data, {
          data: {
            ...request.message.data,
            cid: items.installUUID 
          }
        })
      }
      if (request.message.type && request.message.type.toLowerCase() === 'post') { data.data = JSON.stringify(data.data) }
      // eslint-disable-next-line
      $.ajax(data)
    })
  } 
};

// We always remove chrome.storage.local/findModeRawQueryListIncognito on startup.
chrome.storage.local.remove("findModeRawQueryListIncognito");

// Tidy up tab caches when tabs are removed.  Also remove chrome.storage.local/findModeRawQueryListIncognito if
// there are no remaining incognito-mode windows.  Since the common case is that there are none to begin with,
// we first check whether the key is set at all.
chrome.tabs.onRemoved.addListener(function (tabId) {
  for (let cache of [frameIdsForTab, urlForTab, portsForTab]) { delete cache[tabId]; }
  return chrome.storage.local.get("findModeRawQueryListIncognito", function (items) {
    if (items.findModeRawQueryListIncognito) {
      return chrome.windows != null ? chrome.windows.getAll(null, function (windows) {
        for (let window of windows) {
          if (window.incognito) { return; }
        }
        // There are no remaining incognito-mode tabs, and findModeRawQueryListIncognito is set.
        return chrome.storage.local.remove("findModeRawQueryListIncognito");
      }) : undefined;
    }
  });
});
 
// The install date is shown on the logging page.
chrome.runtime.onInstalled.addListener(function ({reason}) {
  if (!["chrome_update", "shared_module_update"].includes(reason)) { chrome.storage.local.set({installDate: new Date().toString()}); }
  // UUID
  chrome.storage.local.get("installUUID", function (items) { 
    if (!items.installUUID) {
      chrome.storage.local.set({installUUID: `10_${RondomPass(11)}-${+new Date()}-${RondomPass(6)}`}); 
    }
  }) 
});

Object.assign(global, {TabOperations, Frames});
