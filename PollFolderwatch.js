const { readdirSync, lstatSync, statSync } = require('fs');
const { resolve, join } = require('path');

class PollFolderwatch {

    constructor(watchPath, options = null) {
        this._watchPath = resolve(process.cwd(), watchPath);
        this._watchTimer = null;
        this._watchInterval = 600;
        this._lastInfoObject = null;
        this._eventListeners = {};
        this._debounceCache = {};
        this._debounceDelay = 1900;

        if (options) {
            if (options.watchInterval) {
                this._watchInterval = options.watchInterval;
            }
            if (options.debounceDelay) {
                this._debounceDelay = options.debounceDelay;
            }
            if (options.autoStart) {
                this.startWatching();
            }
        }

        return this;
    }

    on(eventName, callback) {
        let callbacks;

        if (eventName === '*') {
            this.on('added', callback)
                .on('changed', callback)
                .on('removed', callback);
        } else {
            if (!(callbacks = this._eventListeners[eventName])) {
                callbacks = this._eventListeners[eventName] = [];
            }
            callbacks.push(callback);
        }

        return this;
    }

    un(eventName, callback) {
        let callbacks;

        if (eventName === '*') {
            this.un('added', callback)
                .un('changed', callback)
                .un('removed', callback);
        } else {
            if (callbacks = this._eventListeners[eventName]) {
                let index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }

        return this;
    }

    fireEvent(eventName) {
        let callbacks;

        if (callbacks = this._eventListeners[eventName]) {
            callbacks.some(cb => cb.apply(this, arguments) === false);
        }

        return this;
    }

    startWatching() {
        if (this._watchTimer) {
            throw new Error('Already watching');
        }
        this._watchTimer = setInterval(this.onWatchTimer.bind(this), this._watchInterval);
        this._lastInfoObject = null;
        return this;
    }

    stopWatching() {
        if (!this._watchTimer) {
            throw new Error('Not watching');
        }
        clearInterval(this._watchTimer);
        return this;
    }

    onWatchTimer() {
        try {
            let newInfoObject = this.createFolderInfoObject(this._watchPath);

            if (this._lastInfoObject) {
                let diffList = this.createDiffList(this._watchPath, this._lastInfoObject, newInfoObject);

                if (this._debounceDelay) {
                    this.debounceEventsForDiffList(diffList);
                } else {
                    this.fireEventsForDiffList(diffList);
                }
            }

            this._lastInfoObject = newInfoObject;
        } catch(error) {
            this.fireEvent('error', `Error when polling filesystem: ${error}`);
        }
    }

    fireEventsForDiffList(diffList) {
        for (let key in diffList) {
            let info = diffList[key].split(':');
            this.fireEvent(info[1], info[0], key);
        }
    }

    debounceEventsForDiffList(diffList) {
        let diffListKeys = Object.keys(diffList),
            eventObject;
        this._debounceCache;

        for (let i = 0; i < diffListKeys.length; i++) {
            let info = diffList[diffListKeys[i]].split(':');

            eventObject = this._debounceCache[diffListKeys[i]];

            if (eventObject) {
                clearTimeout(eventObject.debounceTimer);
                if ((eventObject.eventName === 'removed' && info[1] === 'added') || (eventObject.eventName === 'added' && info[1] === 'removed')) {
                    this._debounceCache[diffListKeys[i]] = undefined;
                    continue;
                }
            }

            this._debounceCache[diffListKeys[i]] = eventObject = {
                debounceTimer: null,
                eventName: info[1],
                type: info[0],
                fullName: diffListKeys[i],
            }
            eventObject.debounceTimer = setTimeout(this.fireDebouncedEvent.bind(this, eventObject), this._debounceDelay);
        }
    }

    fireDebouncedEvent(eventObject) {
        this._debounceCache[eventObject.fullName] = undefined;
        this.fireEvent(eventObject.eventName, eventObject.type, eventObject.fullName);
    }

    createDiffList(basePath, infoObjectOne, infoObjectTwo, existingDiffList = null) {
        let diffList = existingDiffList || {},
            entriesOne = Object.keys(infoObjectOne),
            entriesTwo = Object.keys(infoObjectTwo),
            checkListTwo = [].concat(entriesTwo);

        for (let i = 0; i < entriesOne.length; i++) {
            if (!entriesTwo.includes(entriesOne[i])) {
                if (typeof infoObjectOne[entriesOne[i]] === 'number') {
                    // File deleted
                    diffList[resolve(basePath, entriesOne[i])] = 'file:removed';
                } else {
                    // Folder deleted
                    diffList[resolve(basePath, entriesOne[i])] = 'folder:removed';
                    // Mark all sub-files as removed
                    this.addFilesToDiffListAs(infoObjectOne[entriesOne[i]], diffList, 'removed', resolve(basePath, entriesOne[i]));
                }
            } else {
                checkListTwo.splice(checkListTwo.indexOf(entriesOne[i]), 1);
                if (typeof infoObjectOne[entriesOne[i]] === 'number') {
                    // Exist in both, is file
                    if (infoObjectOne[entriesOne[i]] !== infoObjectTwo[entriesOne[i]]) {
                        // Size changed
                        diffList[resolve(basePath, entriesOne[i])] = 'file:changed';
                    }
                } else {
                    this.createDiffList(resolve(basePath, entriesOne[i]), infoObjectOne[entriesOne[i]], infoObjectTwo[entriesOne[i]], diffList);
                }
            }
        }

        for (let i = 0; i < checkListTwo.length; i++) {
            if (typeof infoObjectTwo[checkListTwo[i]] === 'number') {
                // File added
                diffList[resolve(basePath, checkListTwo[i])] = 'file:added';
            } else {
                // Folder added
                diffList[resolve(basePath, checkListTwo[i])] = 'folder:added';
                // Mark all sub-files as added
                this.addFilesToDiffListAs(infoObjectTwo[checkListTwo[i]], diffList, 'added', resolve(basePath, checkListTwo[i]));
            }
        }

        return diffList;
    }

    addFilesToDiffListAs(infoObject, diffList, asEventType, basePath) {
        for (let key in infoObject) {
            if (typeof infoObject[key] === 'number') {
                diffList[resolve(basePath, key)] = 'file:' + asEventType;
            } else {
                this.addFilesToDiffListAs(infoObject[key], diffList, asEventType, resolve(basePath, key));
            }
        }
    }

    createFolderInfoObject(path) {
        let infoObject = {};

        readdirSync(path).forEach(entity => {
            let fullName = resolve(path, entity),
                lstat = lstatSync(fullName);

            if (lstat.isDirectory()) {
                infoObject[entity] = this.createFolderInfoObject(fullName);
            } else {
                let size = statSync(fullName).size;
                infoObject[entity] = size;
            }
        });

        return infoObject;
    }
}

exports.PollFolderwatch = PollFolderwatch;