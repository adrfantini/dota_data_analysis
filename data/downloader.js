
const opendota_api_key = Math.random().toString(36).substr(2); // optional... actually using a random API key seems to work?
const start_match_id = 6158079010;
const total_downloads = 1000;
const delay_between_calls = 1000; //ms
const output_folder = './data/matches/json/original';


const { OpenDota } = require("opendota.js");
const opendota = new OpenDota(opendota_api_key);
const { writeFile, existsSync, mkdirSync } = require('fs');
let latest_match_id = start_match_id;
let num_downloaded_files = 0;


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
    for (match_id of matches) await download_match(match_id);
}

async function download_match(match_id, try_number = 0, try_max = 5) {
    if (try_number > try_max) {
        console.log('Giving up for match ID ' + match_id + ': too many tries');
        return;
    }

    const output_file = save_path + match_id + '.json';

    if (existsSync(output_file)) return;

    let data;

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
        await sleep(delay_between_calls * 2);
        return await download_match(match_id, try_number + 1);
    }

    writeFile(
        output_file,
        JSON.stringify(data),
        err => { if (err) console.log('Error writing match ID ' + match_id + ': ' + err)}
    );

    num_downloaded_files = num_downloaded_files + 1;
    console.log('Downloaded [' + num_downloaded_files + ']: ' + match_id);

    await sleep(delay_between_calls);
}

async function download() {
    console.log('Start');
    while (num_downloaded_files < total_downloads) {
        console.log('New batch');
        await get_parsed_matches()
            .then(download_matches)
            .catch(err => {
                console.log('Error: ' + err);
                return sleep(delay_between_calls);
            });
    }
}

download();
