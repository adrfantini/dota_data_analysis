const filter = process.argv[2];

console.log('Applying filter "' + filter + '"');

const { filterFunc } = require('./filters/' + filter + '.js');
const { existsSync, mkdirSync, readdirSync, readFileSync, openSync, closeSync } = require('fs');
const writeFile = require('fs').promises.writeFile;

const input_folder = './matches/json/original';
const output_folder = './matches/json/filtered/' + filter;

let nFiles

const counters = {
    writeOK: 0,
    readOK: 0,
    started: 0,
    filter_valid: 0,
    filter_invalid: 0,
    retries: 0,
    errors: {
        no_match_id: 0,
        read: 0,
        filter: 0,
        write: 0
    }
};




mkdirSync(output_folder, {recursive: true});
mkdirSync(output_folder + '/excluded/', {recursive: true});

const files = readdirSync(input_folder)
    .filter(file => file.endsWith('.json'))
    .filter(f => !existsSync(output_folder + '/' + f) && !existsSync(output_folder + '/excluded/' + f));

processFiles(shuffleArray(files));



function updatePB() {
    process.stdout.write(`\r${(counters.started / nFiles * 100).toFixed(2)}% ${JSON.stringify(counters)}`);
}

function processFiles(files) {
    nFiles = files.length;

    console.log(`Start processing ${nFiles} files`);

    const promises = [];
    for (const file of files) promises.push(processFile(file));

    return Promise.allSettled(promises)
    .then((result) => {
        console.log(`\nDone. Summary:\n${JSON.stringify(counters)}`);

        const errors = result.filter(p => p.status != "fulfilled").map(p => p.reason);

        if (errors.length > 0) {
            console.log(`WARNING: found ${errors.length} errors: ${JSON.stringify(errors)}`);
        }
    });
}

function processFile(filename, retry = true) {
    counters.started++;

    const output_file = output_folder + '/' + filename;

    let json;

    try {
        json = JSON.parse(readFileSync(input_folder + '/' + filename));
    } catch(err) {
        counters.errors.read++;
        updatePB();
        throw new Error({fn: filename, err: err.stack || err});
    }

    counters.readOK++;

    if (! json.match_id) {
        counters.errors.no_match_id++;
        updatePB();
        throw new Error({fn: filename, err: "Missing match ID"});
    }

    let filtered;

    try {
        filtered = filterFunc(json);
        if (! filtered) {
            const filename_touch = output_folder + '/excluded/' + filename;
            closeSync(openSync(filename_touch, 'w'));
            counters.filter_invalid++;
            updatePB();
            return;
        }
    } catch(err) {
        counters.errors.filter++;
        updatePB();
        throw new Error({fn: filename, err: err.stack || err});
    }

    counters.filter_valid++;

    return writeFile(output_file, JSON.stringify(filtered))
        .then(() => {
            counters.writeOK++;
            updatePB();
            return {fn: filename};
        })
        .catch((err) => {
            if (retry) {
                counters.retries++;
                updatePB();
                return filterFunc(filename, false);
            } else {
                counters.errors.write++;
                updatePB();
                throw new Error({fn: filename, err: err.stack || err});
            }
        })
}

function shuffleArray(array) { // used to make sure we do not always follow the same order, in case of errors or delays // TODO skip?
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
