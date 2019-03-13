const fs = require('fs');
const Gaze = require('gaze').Gaze;
const logger = require('./logger');

class FolderWatcher {
    constructor(options) {
        this._state = 'idle';
        this._folderPath = options.folderPath;
        this._watchSubFolders = options.watchSubFolders || false;
        this._debounceTime = options.debounceTime || 300;
        this._listeners = [];
        this._watcher = null;

        if (options.autoStart) {
            this.start();
        }

        return this;
    }

    get folderPath() {
        return this._folderPath;
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
                this._watcher = new Gaze('**', { cwd: this._folderPath, mode: 'poll' });
                this._watcher.on('all', this.onWatcherChangeEvent.bind(this));
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
            case 'added':
                this.fireEvent('created', filename);
                break;
            case 'changed':
                this.fireEvent('changed', filename);
                break;
            case 'deleted':
                this.fireEvent('deleted', filename);
                break;
        }
    }

    static onWatcherError(error) {
        logger.logError(`  > FileWatcher ERROR: `, error);
    }
}

module.exports = FolderWatcher;