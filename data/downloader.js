const start_match_id = 6186323321;
const total_downloads = 100000;
const delay_between_calls_small = 50; //ms
const parallel = true; // Downloads the matches in parallel batches of 100 (using promises). Only activate if you have a valid API key, otherwise it's too call-intensive
const delay_between_calls_large = 2000; //ms
const output_folder = './matches/json/original/';
const download_timeout = 20000;


const { writeFileSync, writeFile, existsSync, mkdirSync, readFileSync } = require('fs');
let latest_match_id = start_match_id;
let num_downloaded_files = 0;

const opendota_api_key = readFileSync('./apikey').toString(); // Math.random().toString(36).substr(2); // optional: unset to not use the key. Actually using a random API key seems to work?
const { OpenDota } = require("opendota.js");
const opendota = new OpenDota(opendota_api_key);


mkdirSync(output_folder, {recursive: true})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function get_parsed_matches() {
    return opendota.getParsedMatches({less_than_match_id: latest_match_id}).then(matches => {
        if (!Array.isArray(matches) || matches.length < 1) {
            throw new Error('Invalid response from getParsedMatches: ' + JSON.stringify(matches));
        }

        const match_ids = matches.map(m => m.match_id);

        const last_match = Math.min(...match_ids);

        if (typeof(latest_match_id) === 'number') {
            latest_match_id = last_match;
        } else {
            console.log('Invalid last match ID ' + last_match);
        }

        return match_ids;
    })
}

async function download_matches(matches) {
    console.log('Downloading ' + JSON.stringify(matches));
    if (parallel) {
        const promises = [];
        const timeout = new Promise((resolve, reject) => setTimeout(reject, download_timeout, 'Timeout'));
        for (match of matches) promises.push(Promise.race([download_match(match), timeout]));

        const result = await Promise.allSettled(promises)
        const errors = result.filter(p => p.status != "fulfilled").map(p => p.reason);

        console.log(`Batch finished with ${errors.length} errors: ${JSON.stringify(errors)}`);
        console.log(`Downloaded ${num_downloaded_files} files in total`);

        await sleep(delay_between_calls_large);
    } else {
        for (match_id of matches) {
            try {
                await download_match(match_id);
            } catch(err) {
                console.log(`Error downloading match ID ${match_id}: ${err.stack || err}`);
            }
        }
    }
}

async function download_match(match_id, try_number = 0, try_max = 5) {
    if (try_number > try_max) {
        console.log('Giving up for match ID ' + match_id + ': too many tries');
        return;
    }

    const output_file = output_folder + match_id + '.json';

    if (existsSync(output_file)) return;

    let data;

    // console.log('Downloading match ID ' + match_id);

    try {
        data = await opendota.getMatch(match_id);
    } catch(err) {
        data = {error: err};
    }

    // Sometimes the response is OK, but it actually does not contain good data. We verify this looking at data.match_id
    if (typeof(data.match_id) !== 'number') {
        data.error = data.error || 'unknown error';
    }

    if (data.error) {
        console.log('Error downloading match ID ' + match_id + ': ' + data.error);
        await sleep(delay_between_calls_small * 2);
        return await download_match(match_id, try_number + 1);
    }

    console.log('Writing ' + output_file);

    let writeF = writeFile;

    if (parallel) writeF = writeFileSync;

    // console.log(`Downloading ${output_file}`);

    writeF(
        output_file,
        JSON.stringify(data),
        err => { if (err) console.log('Error writing match ID ' + match_id + ': ' + err)}
    );

    num_downloaded_files++;
    // console.log('Downloaded [' + num_downloaded_files + ']: ' + match_id);

    await sleep(delay_between_calls_small);
}

async function download() {
    console.log('Start');
    while (num_downloaded_files < total_downloads) {
        console.log('New batch');
        try {
            await get_parsed_matches()
                .then(download_matches)
                .catch(err => {
                    console.log('Error: ' + err);
                    return sleep(delay_between_calls_small);
                });
        } catch (err) {
            console.log('Error in get_parsed_matches: ' + err);
        }
    }
}

download();
