/// <reference path="../d.ts/DefinitelyTyped/chrome/chrome.d.ts"/>
/// <reference path="../bg-interface.ts"/>
/// <reference path="../Utils.ts"/>
/// <reference path="../Log.ts"/>

module Popup {
    var prevButton  = document.getElementById("prev");
    var nextButton  = document.getElementById("next");
    var queryInput  = <HTMLInputElement> document.getElementById("query");
    var caseInsensitiveCheckbox = <HTMLInputElement> document.getElementById("case-insensitive");
    var jaumCheckbox = <HTMLInputElement> document.getElementById("jaum");

    var chromeStoreURL = "https://chrome.google.com/webstore/";

    Utils.withActiveTab(function(tab: chrome.tabs.Tab) {
        var id = tab.id;
        var tabStates = BackgroundInterface.getTabStateManager();

        // In most cases the map entry will already be initialized. However, if
        // the user enables/reloads the extension, the tab state will not be
        // initialized (because the content script sent the "loaded" message
        // earlier), so we need to initialize it now.
        if (!tabStates.exists(id)) {
            Log.warning("ID doesn't exist. Initializing entry.")
            tabStates.resetState(id);
            var tabState = tabStates.get(id);
        }

        addListeners(id, tabStates);
        restoreState(id, tabStates);

        setNextButtonState();
        setPrevButtonState(id, tabStates);

        if (tab.url.indexOf(chromeStoreURL) == 0) {
            Log.info("Chrome store detected");
            document.getElementById("chrome-store-warning").style.display = "block";
        }
    });

    function setNextButtonState() {
        if (queryInput.value == "") {
            nextButton.disabled = true;
        } else {
            nextButton.disabled = false;
        }
    }

    function setPrevButtonState(tabId: number, tabStates: TabStateManager) {
        if (tabStates.isSearching(tabId)) {
            prevButton.disabled = false;
        } else {
            prevButton.disabled = true;
        }
    }

    function addListeners(id: number, tabStates: TabStateManager) {
        var prevButtonClick = function() {
            Utils.sendCommand("prev");
        };

        var nextButtonClick = function() {
            if (tabStates.isSearching(id)) {
                Utils.sendCommand("next");
            } else {
                search(id, tabStates);
            }
        };

        var queryInputKeyDown = function(event) {
            if (event.keyCode == 13) {
                Log.info("Enter pressed");
                if (tabStates.isSearching(id)) {
                    if (event.shiftKey) {
                        prevButtonClick();
                    } else {
                        nextButtonClick();
                    }
                } else {
                    search(id, tabStates);
                }
            } else if (event.keyCode == 27) {
                Log.info("Esc pressed");
                setSearching(id, false, tabStates);
                Utils.sendCommand("clear");
            }
        }

        var queryInputInput = function() {
            tabStates.set(id, "query", queryInput.value);

            if (tabStates.isSearching(id)) {
                setSearching(id, false, tabStates);
                Utils.sendCommand("clear");
            }

            // Remove the invalid class if it's there
            queryInput.className = '';

            setNextButtonState();
        }

        var caseInsensitiveCheckboxClick = function() {
            Log.info("Set case-insensitive checkbox state to " + caseInsensitiveCheckbox.checked);
            tabStates.set(id, "caseInsensitive", caseInsensitiveCheckbox.checked);

            if (tabStates.isSearching(id)) {
                setSearching(id, false, tabStates);
                Utils.sendCommand("clear");
            }
        }

        var jaumCheckboxClick = function() {
            Log.info("Set jaum checkbox state to " + jaumCheckbox.checked);
            tabStates.set(id, "jaum", jaumCheckbox.checked);

            if (tabStates.isSearching(id)) {
                setSearching(id, false, tabStates);
                Utils.sendCommand("clear");
            }
        }

        prevButton.addEventListener("click", prevButtonClick);
        nextButton.addEventListener("click", nextButtonClick);
        queryInput.addEventListener("keydown", queryInputKeyDown);
        queryInput.addEventListener("input", queryInputInput);
        caseInsensitiveCheckbox.onclick = caseInsensitiveCheckboxClick;
        jaumCheckbox.onclick = jaumCheckboxClick;
    }

    function restoreState(tabId: number, tabStates: TabStateManager) {
        queryInput.value = tabStates.get(tabId, "query");
        caseInsensitiveCheckbox.checked = tabStates.get(tabId, "caseInsensitive");
        jaumCheckbox.checked = tabStates.get(tabId, "jaum");
    }

    function search(tabId: number, tabStates: TabStateManager) {
        if (validate(queryInput.value)) {
            queryInput.className = '';
            var insensitive = caseInsensitiveCheckbox.checked;
            var isJaum = jaumCheckbox.checked;

            chrome.tabs.sendMessage(tabId,
                                    {
                                        command: "search",
                                        caseInsensitive: insensitive,
                                        jaum: isJaum,
                                        regexp: queryInput.value
                                    });
            setSearching(tabId, true, tabStates);
        } else {
            Log.info("Invalid regex");
            queryInput.className = 'invalid';
        }
    }

    function setSearching(tabId: number, val: boolean, tabStates: TabStateManager) {
        tabStates.set(tabId, "searching", val);
        setPrevButtonState(tabId, tabStates);
    }

    function validate(regexp: string): boolean {
        if (regexp != "") {
            try {
                "".match(regexp);
                return true;
            } catch (e) {
            }
        }
        return false;
    }
}
