/* eslint-disable */
const Commands = {
  availableCommands: {},
  keyToCommandRegistry: null,
  mapKeyRegistry: null,

  init () {
    for (let command of Object.keys(commandDescriptions)) {
      const [description, options] = commandDescriptions[command];
      this.availableCommands[command] = Object.assign((options || {}), {description});
    }

    Settings.postUpdateHooks["keyMappings"] = this.loadKeyMappings.bind(this);
    this.loadKeyMappings(Settings.get("keyMappings"));
  },

  loadKeyMappings (customKeyMappings) {
    let key, command;
    this.keyToCommandRegistry = {};
    this.mapKeyRegistry = {};

    const configLines = Object.keys(defaultKeyMappings).map((key) => `map ${key} ${defaultKeyMappings[key]}`);
    configLines.push(...BgUtils.parseLines(customKeyMappings));

    const seen = {};
    let unmapAll = false;
    for (let line of configLines.reverse()) {
      const tokens = line.split(/\s+/);
      switch (tokens[0].toLowerCase()) {
        case "map":
          if ((tokens.length >= 3) && !unmapAll) {
            var _, optionList, registryEntry;
            [_, key, command, ...optionList] = tokens;
            if (!seen[key] && (registryEntry = this.availableCommands[command])) {
              seen[key] = true;
              const keySequence = this.parseKeySequence(key);
              const options = this.parseCommandOptions(command, optionList);
              this.keyToCommandRegistry[key] =
              Object.assign({keySequence, command, options, optionList}, this.availableCommands[command]);
            }
          }
          break;
        case "unmap":
          if (tokens.length == 2) { seen[tokens[1]] = true; }
          break;
        case "unmapall":
          unmapAll = true;
          break;
        case "mapkey":
          if (tokens.length === 3) {
            const fromChar = this.parseKeySequence(tokens[1]);
            const toChar = this.parseKeySequence(tokens[2]);
            if ((fromChar.length === toChar.length && toChar.length === 1) &&
              this.mapKeyRegistry[fromChar[0]] == null) {
              this.mapKeyRegistry[fromChar[0]] = toChar[0];
            }
          }
          break;
      }
    }

    chrome.storage.local.set({mapKeyRegistry: this.mapKeyRegistry});
    this.installKeyStateMapping();
    this.prepareHelpPageData();

    // Push the key mapping for passNextKey into Settings so that it's available in the front end for insert
    // mode.  We exclude single-key mappings (that is, printable keys) because when users press printable keys
    // in insert mode they expect the character to be input, not to be droppped into some special Vimium
    // mode.
    const passNextKeys = Object.keys(this.keyToCommandRegistry)
      .filter(key => (this.keyToCommandRegistry[key].command === "passNextKey") && (key.length > 1));
    Settings.set("passNextKeyKeys", passNextKeys);
  },

  // Lower-case the appropriate portions of named keys.
  //
  // A key name is one of three forms exemplified by <c-a> <left> or <c-f12>
  // (prefixed normal key, named key, or prefixed named key). Internally, for
  // simplicity, we would like prefixes and key names to be lowercase, though
  // humans may prefer other forms <Left> or <C-a>.
  // On the other hand, <c-a> and <c-A> are different named keys - for one of
  // them you have to press "shift" as well.
  // We sort modifiers here to match the order used in keyboard_utils.js.
  // The return value is a sequence of keys: e.g. "<Space><c-A>b" -> ["<space>", "<c-A>", "b"].
  parseKeySequence: (function () {
    const modifier = "(?:[acms]-)"; // E.g. "a-", "c-", "m-", "s-".
    const namedKey = "(?:[a-z][a-z0-9]+)"; // E.g. "left" or "f12" (always two characters or more).
    const modifiedKey = `(?:${modifier}+(?:.|${namedKey}))`; // E.g. "c-*" or "c-left".
    const specialKeyRegexp = new RegExp(`^<(${namedKey}|${modifiedKey})>(.*)`, "i");
    return function (key) {
      if (key.length === 0) {
        return [];
      // Parse "<c-a>bcd" as "<c-a>" and "bcd".
      } else if (key.search(specialKeyRegexp) === 0) {
        const array = RegExp.$1.split("-");
        const adjustedLength = Math.max(array.length, 1)
        let modifiers = array.slice(0, adjustedLength - 1);
        let keyChar = array[adjustedLength - 1];
        if (keyChar.length !== 1) { keyChar = keyChar.toLowerCase(); }
        modifiers = modifiers.map(m => m.toLowerCase());
        modifiers.sort();
        return ["<" + modifiers.concat([keyChar]).join("-") + ">", ...this.parseKeySequence(RegExp.$2)];
      } else {
        return [key[0], ...this.parseKeySequence(key.slice(1))];
      }
    };
  })(),

  // Command options follow command mappings, and are of one of two forms:
  //   key=value     - a value
  //   key           - a flag
  parseCommandOptions (command, optionList) {
    const options = {};
    for (let option of Array.from(optionList)) {
      const parse = option.split("=", 2);
      options[parse[0]] = parse.length === 1 ? true : parse[1];
    }

    // We parse any `count` option immediately (to avoid having to parse it repeatedly later).
    if ("count" in options) {
      options.count = parseInt(options.count);
      if (isNaN(options.count) || this.availableCommands[command].noRepeat) { delete options.count; }
    }

    return options;
  },

  // This generates and installs a nested key-to-command mapping structure. There is an example in
  // mode_key_handler.js.
  installKeyStateMapping () {
    const keyStateMapping = {};
    for (let keys of Object.keys(this.keyToCommandRegistry || {})) {
      const registryEntry = this.keyToCommandRegistry[keys];
      let currentMapping = keyStateMapping;
      for (let index = 0; index < registryEntry.keySequence.length; index++) {
        const key = registryEntry.keySequence[index];
        if (currentMapping[key] != null ? currentMapping[key].command : undefined) {
          // Do not overwrite existing command bindings, they take priority.  NOTE(smblott) This is the legacy
          // behaviour.
          break;
        } else if (index < (registryEntry.keySequence.length - 1)) {
          currentMapping = currentMapping[key] != null ? currentMapping[key] : (currentMapping[key] = {});
        } else {
          currentMapping[key] = Object.assign({}, registryEntry);
          // We don't need these properties in the content scripts.
          for (let prop of ["keySequence", "description"]) { delete currentMapping[key][prop]; }
        }
      }
    }
    chrome.storage.local.set({normalModeKeyStateMapping: keyStateMapping});
    // Inform `KeyboardUtils.isEscape()` whether `<c-[>` should be interpreted as `Escape` (which it is by
    // default).
    chrome.storage.local.set({useVimLikeEscape: !("<c-[>" in keyStateMapping)});
  },

  // Build the "helpPageData" data structure which the help page needs and place it in Chrome storage.
  prepareHelpPageData () {
    const commandToKey = {};
    for (let key of Object.keys(this.keyToCommandRegistry || {})) {
      const registryEntry = this.keyToCommandRegistry[key];
      (commandToKey[registryEntry.command] != null ? commandToKey[registryEntry.command] : (commandToKey[registryEntry.command] = [])).push(key);
    }
    const commandGroups = {};
    for (let group of Object.keys(this.commandGroups || {})) {
      const commands = this.commandGroups[group];
      commandGroups[group] = [];
      for (let command of commands) {
        commandGroups[group].push({
          command,
          description: this.availableCommands[command].description,
          keys: commandToKey[command] != null ? commandToKey[command] : [],
          advanced: this.advancedCommands.includes(command)
        });
      }
    }
    chrome.storage.local.set({helpPageData: commandGroups});
  },

  // An ordered listing of all available commands, grouped by type. This is the order they will
  // be shown in the help page.
  commandGroups: { 
    vomnibarCommands: [
        "Vomnibar.activate",
        "Vomnibar.activateInNewTab",
        "Vomnibar.activateBookmarks",
        "Vomnibar.activateBookmarksInNewTab",
        "Vomnibar.activateTabSelection",
        "Vomnibar.activateEditUrl",
        "Vomnibar.activateEditUrlInNewTab"
    ] 
  }, 
  // Rarely used commands are not shown by default in the help dialog or in the README. The goal is to present
  // a focused, high-signal set of commands to the new and casual user. Only those truly hungry for more power
  // from Vimium will uncover these gems.
  advancedCommands: [
    // "scrollToLeft",
    // "scrollToRight",
    // "moveTabToNewWindow",
    // "goUp",
    // "goToRoot",
    // "LinkHints.activateModeWithQueue",
    // "LinkHints.activateModeToDownloadLink",
    // "Vomnibar.activateEditUrl",
    // "Vomnibar.activateEditUrlInNewTab"
    // "LinkHints.activateModeToOpenIncognito",
    // "LinkHints.activateModeToCopyLinkUrl",
    // "goNext",
    // "goPrevious",
    // "Marks.activateCreateMode",
    // "Marks.activateGotoMode",
    // "moveTabLeft",
    // "moveTabRight",
    // "closeTabsOnLeft",
    // "closeTabsOnRight",
    // "closeOtherTabs",
    // "enterVisualLineMode",
    // "toggleViewSource",
    // "passNextKey"
  ]
};

const defaultKeyMappings = { 
  // Vomnibar
  "o": "Vomnibar.activate",
  "O": "Vomnibar.activateInNewTab",
  "T": "Vomnibar.activateTabSelection",
  "b": "Vomnibar.activateBookmarks",
  "B": "Vomnibar.activateBookmarksInNewTab"
  // "ge": "Vomnibar.activateEditUrl",
  // "gE": "Vomnibar.activateEditUrlInNewTab", 
};

// This is a mapping of: commandIdentifier => [description, options].
// If the noRepeat and repeatLimit options are both specified, then noRepeat takes precedence.
const commandDescriptions = { 
  "Vomnibar.activate": ["搜索CSDN、书签、历史记录、URL", { topFrame: true }],
  "Vomnibar.activateInNewTab": ["搜索CSDN、书签、历史记录、URL并在标签页打开", { topFrame: true }],
  "Vomnibar.activateTabSelection": ["搜索打开的标签页", { topFrame: true }],
  "Vomnibar.activateBookmarks": ["搜索书签", { topFrame: true }],
  "Vomnibar.activateBookmarksInNewTab": ["搜索书签并在新标签页打开", { topFrame: true }],
  "Vomnibar.activateEditUrl": ["编辑当前URL", { topFrame: true }],
  "Vomnibar.activateEditUrlInNewTab": ["编辑当前URL并在新窗口打开", { topFrame: true }]
};

Commands.init();

global.Commands = Commands;
