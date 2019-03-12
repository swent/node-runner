const pkg = require('./package.json');
const child_process = require('child_process');
const path = require('path');
const process = require('process');
const fs = require('fs');
const folderWatcher = require('./folderwatcher');
const logger = require('./logger');
const cwd = process.cwd();
const dropInsFolder = path.resolve(cwd, pkg.dropInsFolder);

class DropIn {
    constructor(name) {
        this._name = name;
        this._folderPath = path.resolve(dropInsFolder, name);
        this._state = 'idle';
        this._watcher = new folderWatcher({
            folderPath: this._folderPath,
            debounceTime: 1000,
            autoStart: true,
        });
        this._process = null;
        this._processRunning = false;
        this._debounceTimer = 0;
        this._restartTimer = 0;
        this._forceStop = false;
        this._destroyed = false;
        this.start();
        this._watcher.on('*', this.onDropInFolderContentChanged.bind(this));

        return this;
    }

    get name() {
        return this._name;
    }

    get state() {
        return this._state;
    }

    get destroyed() {
        return this._destroyed;
    }

    onDropInFolderContentChanged() {
        this.debounceStart(3000);
    }

    debounceStart(debounceTime) {
        this.stop();

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        } else {
            logger.logInformation(`  > Queueing drop-in "${this.name}" for start ...`);
        }
        this._debounceTimer = setTimeout(this.start.bind(this), debounceTime);
    }

    start() {
        if (this._destroyed) {
            throw new Error('Drop-In already destroyed !');
        }

        this._debounceTimer = 0;
        this._forceStop = false;
        if (this.state === 'idle') {
            this.executeStart();
        }
    }

    executeStart() {
        this._restartTimer = 0;

        logger.logInformation(`  > Starting drop-in "${this.name}" ...`);
        this._state = 'starting';
        if (this.checkFiles()) {
            if (this.restoreNpmPackages()) {
                if (!this._forceStop) {
                    if (this.startNodeProcess()) {
                        this._state = 'running';
                        if (this._forceStop) {
                            this.stop();
                        }
                        return true;
                    } else {
                        logger.logError(`    ERROR: starting node process failed !`);
                    }
                }
            } else {
                logger.logError(`    ERROR: package restore failed !`);
            }
        } else {
            logger.logError(`    ERROR: package.json missing !`);
        }

        if (!this._forceStop) {
            logger.logInformation(`  > Start of drop-in "${this.name}" failed, scheduling restart in 8s ...`);
            this._restartTimer = setTimeout(this.executeStart.bind(this), 8000);
        }
        return false;
    }

    checkFiles() {
        return fs.existsSync(path.resolve(this._folderPath, 'package.json'));
    }

    restoreNpmPackages() {
        let output = child_process.execSync('npm install', {
            cwd: this._folderPath,
            encoding: 'utf8'
        });

        let regex = new RegExp('audited [0-9]+ package(s)?');

        return regex.test(output);
    }

    startNodeProcess() {
        let result = true;

        try {
            this._process = child_process.exec('npm start', {
                cwd: this._folderPath,
                encoding: 'utf8'
            });
            this._processRunning = true;
            this._process.on('close', this.onProcessClose.bind(this));
            this._process.stdout.on('data', this.onProcessData.bind(this));
            this._process.stderr.on('data', this.onProcessError.bind(this));
              
        } catch (error) {
            result = false;
        }

        return result;
    }

    onProcessClose(exitCode) {
        this._processRunning = false;
        this._process = null;
        logger.logWarning(`  > Node process of drop-in "${this.name}" exited with code ${exitCode} !`);
        if (!this._forceStop) {
            this.debounceStart(8000);
        }
    }

    onProcessData(data) {
        // console.log('data:', this.name, data);
    }

    onProcessError(data) {
        // console.log('error:', this.name, data);
    }

    stop() {
        if (this._destroyed) {
            throw new Error('Drop-In already destroyed !');
        }

        if (this.state !== 'idle') {
            logger.logInformation(`  > Stopping drop-in "${this.name}" ...`);

            this._forceStop = true;
            if (this.state === 'starting') {
                clearTimeout(this._restartTimer);
                this._restartTimer = 0;
            } else {
                if (this._process && this._processRunning) {
                    this._process.exit(0);
                }
            }

            this._state = 'idle';
        }
    }

    destroy() {
        if (!this._destroyed) {
            this.stop();
            this._watcher.stop();
            clearTimeout(this._debounceTimer);
            this._destroyed = true;
        } else {
            throw new Error('Drop-In already destroyed !');
        }

        return this;
    }
}

module.exports.dropIn = DropIn;
module.exports.dropInsFolder = dropInsFolder;