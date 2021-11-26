const request = require('request');
const express = require('express');
const { existsSync, readdirSync, mkdirSync, lstatSync } = require('fs');
const { resolve, sep } = require('path');
const { DropIn } = require('./DropIn');
const logger = require('./Logger');
const { Watcher } = require('./Watcher');

const app = express();
const pkg = require('./package.json');
const settings = require('./Settings');
const version = pkg.version;
const nodeVersion = process.version;
const port = settings.port || 8080;

const dropInsFolder = resolve(process.cwd(), settings.dropInsFolder);
const watcher = new Watcher(dropInsFolder, {
    autoStart: true
});
const dropIns = [];
let lastDropIns;

function registerDropIn(fullPath) {
    let pathParts = fullPath.split(sep),
        dropInName = pathParts[pathParts.length - 1],
        port = getUnusedPort();

    logger.information(`  > Registering new drop-in "${dropInName}" ...`);
    dropIns.push(lastDropIns = new DropIn(dropInName, fullPath, port));
}

function unregisterDropIn(dropInName) {
    logger.information(`  > Unregistering drop-in "${dropInName}" ...`);
    let dropIn = dropIns.splice(dropIns.findIndex(di => di.name === dropInName), 1)[0];
    if (dropIn) {
        dropIn.destroy();
    } else {
        logger.error(`    Drop-in could not be found in loaded drop-ins ! A list of loaded drop-ins following:`);
        dropIns
            .map(di => `    - ${di.name}: ${di.fullPath}`)
            .forEach(di => logger.error(di));
    }
}

function restartDropIn(dropInName) {
    let dropIn = dropIns.find(di => di.name === dropInName);

    if (dropIn) {
        logger.information(`  > Restarting drop-in "${dropInName}" ...`);
        dropIn.restart();
    }
}

function loadDropIns(dropInsFolder) {
    if (!existsSync(dropInsFolder)) {
        try {
            logger.information(`  > Drop-ins folder does not exist, creating folder "${dropInsFolder}" ...`);
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

function onWatcherEvent(event, dirName) {
    if (event === 'added') {
        registerDropIn(resolve(dropInsFolder, dirName));
    } else {
        unregisterDropIn(dirName);
    }
}

function getUnusedPort() {
    let ports = dropIns.map(di => di.port);

    for (let i = 8100; i < 9000; i++) {
        if (!ports.includes(i)) {
            return i;
        }
    }
    logger.error('  > ERROR: unable to find unused drop-in port, all ports already in use.');
    return null;
}


/* Register request proxy */
app.all('*', (req, res) => {
    let urlParts = req.originalUrl.split('/'),
        dropInName = urlParts.splice(0, 2)[1],
        dropIn = dropIns.find(di => di.name === dropInName);

    if (dropIn) {
        if (['PUT', 'POST', 'DELETE'].includes(req.method)) {
            req.pipe(request[req.method.toLowerCase()](`http://localhost:${dropIn.port}/${urlParts.join('/')}`))
                .pipe(res);
        } else {
            request(`http://localhost:${dropIn.port}/${urlParts.join('/')}`).pipe(res);
        }
    } else {
        res.status(404).end();
    }
});

/* Start listening, then initialize drop-ins */
app.listen(port, () => {
    logger.information('##################################################');
    logger.information(`# node-runner v${version}`);
    logger.information('##################################################');
    logger.information('#');
    logger.information(`# Drop-ins path:   ${dropInsFolder}`);
    logger.information(`# Node version:    ${nodeVersion}`);
    logger.information(`# Http port:       ${port}`);
    logger.information('#');

    /* Load drop-ins that are already in place */
    loadDropIns(dropInsFolder);

    /* Register changes to the folders */
    watcher.on('added', onWatcherEvent.bind(this));

    logger.information('  > List of loaded drop-ins:');
    dropIns
        .map(di => `    - ${di.name}: ${di.fullPath}`)
        .forEach(di => logger.information(di));
    logger.information('');
});
