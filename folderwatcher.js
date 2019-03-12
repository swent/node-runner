const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class FolderWatcher {
    constructor(options) {
        this._state = 'idle';
        this._folderPath = options.folderPath;
        this._watchSubFolders = options.watchSubFolders || false;
        this._debounceTime = options.debounceTime || 300;
        this._listeners = [];
        this._watcher = null;
        this._lastRenamed = null;
        this._renameTimeout = 0;

        if (options.autoStart) {
            this.start();
        }

        return this;
    }

    get state() {
        return this._state;
    }

    checkSettings() {
        return ['idle', 'watching'].includes(this.state) &&
            typeof this._debounceTime === 'number' &&
            this._debounceTime >= 0 &&
            fs.existsSync(this._folderPath);
    }

    start() {
        if (this.state === 'idle' && this.checkSettings()) {
            try {
                this._watcher = fs.watch(this._folderPath, this.onWatcherChangeEvent.bind(this));
                this._watcher.on('error', FolderWatcher.onWatcherError.bind(this));
                this._state = 'watching';
            } catch (error) {
                throw new Error(`Watching the folder "${this._folderPath}" resulted in an error: ${error}`);
            }
        } else {
            throw new Error('FolderWatcher in invalid state or configuration invalid. Please check.');
        }

        return this;
    }

    stop() {
        if (this.state === 'watching') {
            try {
                this._watcher.close();
                this._state = 'idle';
            } catch (error) {
                throw new Error(`Stopping watcher resulted in an error: ${error}`);
            }
        } else {
            throw new Error(`FolderWatcher in invalid state: ${this._state}`);
        }

        return this;
    }

    on(eventType, callback) {
        this._listeners.push({
            eventType: eventType,
            callback: callback,
        });
    }

    fireEvent(eventType) {
        this._listeners
            .filter(l => l.eventType === '*' || l.eventType === eventType)
            .forEach(l => l.callback.call(this, eventType, ...Array.prototype.splice.call(arguments, 1)));
    }

    onWatcherChangeEvent(eventType, filename) {
        switch (eventType) {
            case 'rename':
                if (fs.existsSync(path.resolve(dropInsFolder, filename))) {
                    if (this._lastRenamed) {
                        clearTimeout(this._renameTimeout);
                        this.fireEvent('rename', this._lastRenamed, filename);
                        this._lastRenamed = null;
                    } else {
                        this.fireEvent('create', filename);
                    }
                    
                } else {
                    this._lastRenamed = filename;
                    this._renameTimeout = setTimeout(() => {
                        this.fireEvent('delete', filename);
                    }, 1);
                }
                break;

            case 'change':
                this.fireEvent('change', filename);
                break;
        }
    }

    static onWatcherError() {
        logger.logError(`  > FileWatcher ERROR: `, arguments);
    }
}

module.exports = FolderWatcher;