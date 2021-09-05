function filterFunc(json) {
    const ranks = json.players.map(p => p.rank_tier);
    const isRadiant = json.players.map(p => p.isRadiant);

    const radiant_ranks = [];
    const dire_ranks = [];

    for (const i in isRadiant) {
        const rank = ranks[i];
        if (rank) {
            isRadiant[i] ? radiant_ranks.push(rank) : dire_ranks.push(rank);
        }
    }

    if (
        radiant_ranks.length < 2  ||
        radiant_ranks.length != dire_ranks.length ||
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

    return {
        match_id: json.match_id,
        radiant_win: json.radiant_win,
        region: json.region,
        radiant_ranks: radiant_ranks,
        dire_ranks: dire_ranks,
    }
}

module.exports = {filterFunc : filterFunc}
