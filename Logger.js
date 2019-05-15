const pkg = require('./package.json');
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const logPath = path.resolve(cwd, pkg.logFile);
const minLogLevel = pkg.minLogLevel;

class Logger {
    constructor(filePath) {
        this._filePath = filePath;
        this._logQueue = [];
        this._logTimer = setInterval(this.writeLogFile.bind(this), 1500);
        return this;
    }

    get filePath() {
        return this._filePath;
    }

    writeLogFile() {
        if (this._logQueue.length) {
            let linesToLog = this._logQueue.splice(0);
            fs.appendFileSync(this._filePath, linesToLog.join('\n') + '\n');
        }
    }

    static get timestamp() {
        let currentDate = new Date();
        return `${currentDate.getFullYear()}/${Logger.padNumber(currentDate.getMonth() + 1)}/${Logger.padNumber(currentDate.getDate())} | ${Logger.padNumber(new Date().getHours())}:${Logger.padNumber(new Date().getMinutes())}:${Logger.padNumber(new Date().getSeconds())}`;
    }

    static padNumber(number) {
        let stringified = number.toString();
        return `${stringified.length === 1 ? '0' : ''}${stringified}`;
    }

    trace(message) {
        if (minLogLevel < 1) {
            let logMsg = `[${Logger.timestamp}] [T] ${message}`;
            this._logQueue.push(logMsg);
            console.log(logMsg);
            return this;
        }
    }

    debug(message) {
        if (minLogLevel < 2) {
            let logMsg = `[${Logger.timestamp}] [D] ${message}`;
            this._logQueue.push(logMsg);
            console.log(logMsg);
            return this;
        }
    }

    information(message) {
        if (minLogLevel < 3) {
            let logMsg = `[${Logger.timestamp}] [I] ${message}`;
            this._logQueue.push(logMsg);
            console.log(logMsg);
            return this;
        }
    }

    warning(message) {
        if (minLogLevel < 4) {
            let logMsg = `[${Logger.timestamp}] [W] ${message}`;
            this._logQueue.push(logMsg);
            console.log(logMsg);
            return this;
        }
    }

    error(message) {
        if (minLogLevel < 5) {
            let logMsg = `[${Logger.timestamp}] [E] ${message}`;
            this._logQueue.push(logMsg);
            console.log(logMsg);
            return this;
        }
    }
}

module.exports = new Logger(logPath);