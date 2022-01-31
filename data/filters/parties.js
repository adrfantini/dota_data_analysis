function getParties(players) {
    getRoles(players)

    const parties = new Set(players.filter(p => p.party_size > 1).map(p => p.party_id))

    return Array.from(parties).map(party => players.filter(p => p.party_id == party).map(p => p.role).sort().join(''))
}

function getRoles(players) { // get roles for every player object, from 1 (carry) to 5 (safelane support)
    const max_safelane_eff = Math.max(...players.filter(p => p.lane_role === 1).map(p => p.lane_efficiency));
    const max_offlane_eff = Math.max(...players.filter(p => p.lane_role === 3).map(p => p.lane_efficiency));
    // it might happpen that 2 players have the same exact eff... who cares

    for (const player of players) {
        if (player.lane_role === 2) { // midlane
            player.role = 2;
        } else if (player.lane_role === 1) { // safelane
            if (player.lane_efficiency - max_safelane_eff) {
                player.role = 1;
            } else {
                player.role = 5;
            }
        } else { // offlane
            if (player.lane_efficiency == max_offlane_eff) {
                player.role = 3;
            } else {
                player.role = 4;
            }
        }
    }
}

function filterFunc(json) {
    // Generic filter
    if (
        json.players.map(p => p.abandons).some(x => x > 1) ||
        json.players.map(p => p.leaver_status).some(x => x > 0) ||
        json.duration < 60 * 20 || // 20 minutes
        json.game_mode != 22 ||
        json.human_players != 10 ||
        json.patch != 49 ||
        ![0,5,6,7].includes(json.lobby_type)
    ) {
        return;
    }

    // Only take games with parties
    parties = json.players.filter(p => p.party_size > 1);
    if (parties.length < 1) {return;}

    // Check that lanes are 2-1-2
    const lanes = [0,0,0,0,0,0]; // rad 1,2,3 (safe, mid, off); dire 1;2;3 (safe, mid, off)
    json.players.forEach(p => {
        const lane = p.lane_role + (p.isRadiant ? 0 : 3) - 1
        lanes[lane] = lanes[lane] + 1
    });
    if (
        lanes[0] !== 2 || // radiant safelane
        lanes[1] !== 1 || // radiant midlane
        lanes[2] !== 2 || // radiant offlane
        lanes[3] !== 2 || // dire safelane
        lanes[4] !== 1 || // dire midlane
        lanes[5] !== 2    // dire offlane
    ) {return;}

    // Check we are 5v5
    const radiant = json.players.filter(p => p.isRadiant);
    const dire = json.players.filter(p => !p.isRadiant);
    if (radiant.length !== 5 || dire.length !== 5) {return;}

    const radiant_win = json.radiant_win;

    win_parties = getParties(json.radiant_win ? radiant : dire);
    lose_parties = getParties(json.radiant_win ? dire : radiant);

    return {
        match_id: json.match_id,
        radiant_win: json.radiant_win,
        win_parties: win_parties,
        lose_parties: lose_parties
    };
}

module.exports = {filterFunc : filterFunc}
