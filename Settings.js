const { existsSync, writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');

function loadOrCreateSettings() {
    let settingsPath = resolve(process.cwd(), "settings.json");
    if (!existsSync(settingsPath)) {
        writeFileSync(settingsPath, JSON.stringify({
            "dropInsFolder": "../dropins",
            "logFile": "runtime.log",
            "minLogLevel": 2,
            "port": 8080,
            "dropInsScanInterval": 3000,
            "dropInsRestartDelay": 7000,
        }), { encoding: 'utf8' });
    }

    return JSON.parse(readFileSync(settingsPath, { encoding: 'utf8' }));
}

module.exports = loadOrCreateSettings();
