const pkg = require('./package.json');
const fs = require('fs');
const process = require('process');
const folderWatcher = require('./folderwatcher');
const { dropIn, dropInsFolder } = require('./dropin');
const logger = require('./logger');
const version = pkg.version;
const nodeVersion = process.version;

let _dropIns = [];

function registerDropIn(dropInName) {
    logger.logInformation(`  > Registering new drop-in "${dropInName}" ...`);
    _dropIns.push(new dropIn(dropInName));
    logger.logInformation(`    List: ${_dropIns.map(di => di.name).join(', ')}`);
}

function unregisterDropIn(dropInName) {
    logger.logInformation(`  > Unregistering drop-in "${dropInName}" ...`);
    let dropIn = _dropIns.splice(_dropIns.findIndex(di => di.name === dropInName), 1)[0];
    dropIn.destroy();
    logger.logInformation(`    List: ${_dropIns.map(di => di.name).join(', ')}`);
}

function loadDropInFolders() {
    if (fs.existsSync(dropInsFolder)) {
        return fs.readdirSync(dropInsFolder);
    } else {
        throw new Error('Drop-ins folder does not exist.');
    }
}

function registerDropInFolders(folders) {
    folders.forEach(registerDropIn.bind(this));
}

const _mainWatcher = new folderWatcher({
    folderPath: dropInsFolder,
    debounceTime: 1000,
});

function onMainWatcherEvent(eventType) {
    let data = Array.prototype.splice.call(arguments, 1);
    
    switch (eventType) {
        case 'create':
            registerDropIn(data[0]);
            break;
        case 'rename':
            unregisterDropIn(data[0]);
            registerDropIn(data[1]);
            break;
        case 'delete':
            unregisterDropIn(data[0]);
            break;
    }
}

let dropInFolders = loadDropInFolders();
_mainWatcher.on('*', onMainWatcherEvent.bind(this));
_mainWatcher.start();

logger.logInformation('##################################################');
logger.logInformation(`# node-runner v${version}`);
logger.logInformation('##################################################');
logger.logInformation('#');
logger.logInformation(`# Drop-ins path:   ${dropInsFolder}`);
logger.logInformation(`# Loaded drop-ins: ${dropInFolders.join(', ')}`);
logger.logInformation(`# node version:    ${nodeVersion}`);
logger.logInformation('#');

registerDropInFolders(dropInFolders);