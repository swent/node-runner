const { readdirSync } = require('fs');
const { resolve } = require('path');

class Watcher {

    _baseFolder = null;
    _interval = 10;
    _callbacks = {};
    _lastCheckResult = [];

    _running = false;
    _timer = null;


    constructor(baseFolder, options) {
        this._baseFolder = baseFolder;
        this._interval = options.interval || 10;
        if (options.autoStart) {
            this.start();
        }
    }

    start() {
        if (this._running) {
            throw new Error('Unable to start watcher, already running');
        }

        this._running = true;
        this._timer = setInterval(this._executeCheck.bind(this), this._interval * 1000);
        this._lastCheckResult = this._getCheckResult();
    }

    stop() {
        if (!this._running) {
            throw new Error('Unable to stop watcher, not running');
        }

        this._running = false;
        clearInterval(this._timer);
        this._timer = null;
    }

    on(event, callback) {
        if (!this._callbacks.event) {
            this._callbacks[event] = [];
        }
        this._callbacks[event].push(callback);
    }

    un(event, callback) {
        if (this._callbacks.event) {
            this._callbacks[event].splice(this._callbacks[event].indexOf(callback), 1);
        }
    }

    _fireEvent() {
        const event = arguments[0];
        if (this._callbacks[event]) {
            this._callbacks[event].forEach(cb => cb.apply(null, arguments));
        }
    }

    _executeCheck() {
        const foldersWithPackageJson = this._getCheckResult();

        const added = foldersWithPackageJson.filter(dirName => !this._lastCheckResult.includes(dirName));
        const removed = this._lastCheckResult.filter(dirName => !foldersWithPackageJson.includes(dirName));

        added.forEach(dirName => this._fireEvent('added', dirName));
        removed.forEach(dirName => this._fireEvent('removed', dirName));

        this._lastCheckResult = foldersWithPackageJson;
    }

    _getCheckResult() {
        const foldersToCheck = readdirSync(this._baseFolder, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .map(dir => dir.name);

        return foldersToCheck.filter(dirName => {
            return !!readdirSync(resolve(this._baseFolder, dirName)).find(file => file === 'package.json');
        });
    }
}

module.exports = { Watcher: Watcher };
