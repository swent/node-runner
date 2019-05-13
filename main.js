const pkg = require('./package.json');
const { existsSync, readdirSync, mkdirSync, lstatSync, statSync } = require('fs');
const { resolve, sep } = require('path');
const { PollFolderwatch } = require('./PollFolderwatch');
const { DropIn } = require('./DropIn');
const logger = require('./Logger');

const version = pkg.version;
const nodeVersion = process.version;

const dropInsFolder = resolve(process.cwd(), pkg.dropInsFolder);
const watcher = new PollFolderwatch(dropInsFolder, { autoStart: true });
const dropIns = [];

function registerDropIn(fullPath) {
    let pathParts = fullPath.split(sep),
        dropInName = pathParts[pathParts.length - 1];

    logger.information(`  > Registering new drop-in "${dropInName}" ...`);
    dropIns.push(new DropIn(dropInName, fullPath));
    logger.information(`    List: ${dropIns.map(di => di.name).join(', ')}`);
}

function unregisterDropIn(dropInName) {
    logger.information(`  > Unregistering drop-in "${dropInName}" ...`);
    let dropIn = dropIns.splice(dropIns.findIndex(di => di.name === dropInName), 1)[0];
    dropIn.destroy();
    logger.information(`    List: ${dropIns.map(di => di.name).join(', ')}`);
}

function restartDropIn(dropInName) {
    let dropIn = dropIns.splice(dropIns.findIndex(di => di.name === dropInName), 1)[0];

    if (dropIn) {
        logger.information(`  > Restarting drop-in "${dropInName}" ...`);
        dropIn.restart();
    }
}

function loadDropIns(dropInsFolder) {
    if (!existsSync(dropInsFolder)) {
        try {
            mkdirSync(dropInsFolder)
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /* Load all folders, filter for those that contain package.json file, register remaining as drop-ins */
    readdirSync(dropInsFolder)
        .map(f => resolve(dropInsFolder, f))
        .filter(f => lstatSync(f).isDirectory())
        .filter(f => readdirSync(f).includes('package.json'))
        .forEach(f => registerDropIn(f));
}

function onWatcherEvent(eventName, type, fullName) {
    let pathParts = fullName.substring(dropInsFolder.length + 1).split(sep);

    if (type === 'file' && pathParts.length === 2 && pathParts[1].toLowerCase() === 'package.json' && ['added', 'removed'].includes(eventName)) {
        // package.json inside drop-in folder has been added or removed
        if (eventName === 'added') {
            registerDropIn(fullName.substring(0, fullName.length - pathParts[1].length - 1));
        } else {
            unregisterDropIn(pathParts[0]);
        }
    } else if (type === 'file' && pathParts.length >= 2) {
        // Change to some file in drop-in folder -> notify drop in to restart
        restartDropIn(pathParts[0]);
    }
}


logger.information('##################################################');
logger.information(`# node-runner v${version}`);
logger.information('##################################################');
logger.information('#');
logger.information(`# Drop-ins path:   ${dropInsFolder}`);
logger.information(`# node version:    ${nodeVersion}`);
logger.information('#');

/* Load drop-ins that are already in place */
loadDropIns(dropInsFolder);

/* Register changes to the folders */
watcher.on('*', onWatcherEvent.bind(this));

/* Register watcher error events */
watcher.on('error', error => logger.error('  > ' + error));