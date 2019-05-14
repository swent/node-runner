const child_process = require('child_process');
const { resolve } = require('path');
const fs = require('fs');
const logger = require('./Logger');

class DropIn {
    constructor(name, fullPath) {
        this._name = name;
        this._fullPath = fullPath;
        this._state = 'idle';
        this._process = null;
        this._processRunning = false;
        this._debounceTimer = 0;
        this._restartTimer = 0;
        this._forceStop = false;
        this._destroyed = false;
        let scripts = JSON.parse(fs.readFileSync(resolve(fullPath, 'package.json'), { encoding: 'utf8' })).scripts;
        if (scripts && scripts.start) {
            this._startScript = scripts.start;
        } else {
            throw new Error('Drop-In has no start script !');
        }

        this.start();

        return this;
    }

    get name() {
        return this._name;
    }

    get fullPath() {
        return this._fullPath;
    }

    get state() {
        return this._state;
    }

    get destroyed() {
        return this._destroyed;
    }

    start() {
        if (this._destroyed) {
            throw new Error('Drop-In already destroyed !');
        }

        this._debounceTimer = 0;
        this._forceStop = false;
        if (this.state === 'idle') {
            this._executeStart();
        }
    }

    restart() {
        this._debounceRestart(3000);
    }

    stop() {
        if (this._destroyed) {
            throw new Error('Drop-In already destroyed !');
        }

        if (this.state !== 'idle') {
            logger.information(`  > Stopping drop-in "${this.name}" ...`);

            this._forceStop = true;
            if (this.state === 'starting') {
                clearTimeout(this._restartTimer);
                this._restartTimer = 0;
            } else {
                if (this._process && this._processRunning) {
                    this._process.kill('SIGINT');
                }
            }

            this._state = 'idle';
        }
    }

    destroy() {
        if (!this._destroyed) {
            this.stop();
            clearTimeout(this._debounceTimer);
            this._destroyed = true;
        } else {
            throw new Error('Drop-In already destroyed !');
        }

        return this;
    }

    _debounceRestart(debounceTime) {
        this.stop();

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        } else {
            logger.information(`  > Queueing drop-in "${this.name}" for start ...`);
        }
        this._debounceTimer = setTimeout(this.start.bind(this), debounceTime);
    }

    _executeStart() {
        this._restartTimer = 0;

        logger.information(`  > Starting drop-in "${this.name}" ...`);
        this._state = 'starting';
        if (this._checkFiles()) {
            if (this._restoreNpmPackages()) {
                if (!this._forceStop) {
                    if (this._startNodeProcess()) {
                        this._state = 'running';
                        if (this._forceStop) {
                            this.stop();
                        }
                        return true;
                    } else {
                        logger.error(`    ERROR: starting node process failed !`);
                    }
                }
            } else {
                logger.error(`    ERROR: package restore failed !`);
            }
        } else {
            logger.error(`    ERROR: package.json missing !`);
        }

        if (!this._forceStop) {
            logger.information(`  > Start of drop-in "${this.name}" failed, scheduling restart in 8s ...`);
            this._restartTimer = setTimeout(this._executeStart.bind(this), 8000);
        }
        return false;
    }

    _checkFiles() {
        return fs.existsSync(resolve(this._fullPath, 'package.json'));
    }

    _restoreNpmPackages() {
        logger.debug(`    Restoring npm packages of "${this.name}" ...`);
        let output = child_process.execSync('npm install', {
            cwd: this._fullPath,
            encoding: 'utf8'
        });

        let regex = new RegExp('audited [0-9]+ package(s)?');
        let success = regex.test(output);

        logger.debug(`    ${success ? 'Success' : 'Failed'} !`);

        return success;
    }

    _startNodeProcess() {
        let result = true;

        try {
            logger.debug(`    Starting node process of "${this.name}" ...`);
            let startScriptParts = this._startScript.split(' '),
                executable = startScriptParts.splice(0, 1)[0];
            this._process = child_process.spawn(executable, startScriptParts, {
                cwd: this._fullPath,
                encoding: 'utf8'
            });
            this._process.on('error', logger.error.bind(logger));
            this._processRunning = true;
            this._process.on('close', this.onProcessClose.bind(this));
            this._process.stdout.on('data', this.onProcessData.bind(this));
            this._process.stderr.on('data', this.onProcessError.bind(this));
              
        } catch (error) {
            result = false;
        }

        logger.debug(`    ${result ? 'Success' : 'Failed'} !`);

        return result;
    }

    onProcessClose(exitCode) {
        this._processRunning = false;
        this._process = null;
        logger.warning(`  > Node process of drop-in "${this.name}" exited with code ${exitCode} !`);
        if (!this._forceStop) {
            this._debounceRestart(8000);
        }
    }

    onProcessData(data) {
        //logger.debug(`  > Drop-In "${this.name}" stdout: ${data}`);
    }

    onProcessError(data) {
        //logger.information(`  > Drop-In "${this.name}" stderr: ${data}`);
    }
}

module.exports.DropIn = DropIn;