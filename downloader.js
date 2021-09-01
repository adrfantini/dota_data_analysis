
const opendota_api_key = undefined; // optional
const start_match_id = 6158112980;
const total_downloads = 20000;
const delay_between_calls = 1000; //ms
const save_path = './data/matches/json/';


const { OpenDota } = require("opendota.js");
const opendota = new OpenDota(opendota_api_key);
const { writeFile, existsSync, mkdir } = require('fs');
let latest_match_id = start_match_id;
let num_downloaded_files = 0;


mkdir(save_path)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function get_parsed_matches() {
    return opendota.getParsedMatches({less_than_match_id: latest_match_id}).then(matches => {
        if (!Array.isArray(matches) || matches.length < 1) {
            return [];
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
    for (match_id of matches) await download_match(match_id)
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

    // Sometimes the response is OK, but it actually does not contain good data. We verify this looking at data.swagger
    if (data.swagger) {
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

async function main() {
    while (num_downloaded_files < total_downloads) {
        await get_parsed_matches().then(download_matches);
    }
}

main();
