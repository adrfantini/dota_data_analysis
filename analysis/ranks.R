name = 'ranks'

library(dplyr)
library(purrr)
library(ggplot2)
library(jsonlite)
library(furrr)

plan(multisession, workers = 4)

input_folder = paste0("../data/matches/json/filtered/", name)
output_folder = paste0("outputs/", name)

dir.create(output_folder, showWarnings = FALSE, recursive = TRUE)

files = list.files(input_folder, pattern = ".*\\.json$", full.names = TRUE)

rank2mmr = list( # taken from https://dota2.fandom.com/wiki/Matchmaking/Seasonal_Rankings on 05 Sept 2021
    "11" = 0,
    "12" = 154,
    "13" = 308,
    "14" = 462,
    "15" = 616,
    "21" = 770,
    "22" = 924,
    "23" = 1078,
    "24" = 1232,
    "25" = 1386,
    "31" = 1540,
    "32" = 1694,
    "33" = 1848,
    "34" = 2002,
    "35" = 2156,
    "41" = 2310,
    "42" = 2464,
    "43" = 2618,
    "44" = 2772,
    "45" = 2926,
    "51" = 3080,
    "52" = 3234,
    "53" = 3388,
    "54" = 3542,
    "55" = 3696,
    "61" = 3850,
    "62" = 4004,
    "63" = 4158,
    "64" = 4312,
    "65" = 4466,
    "71" = 4620,
    "72" = 4820,
    "73" = 5020,
    "74" = 5220,
    "75" = 5420,
    "80" = 6000 # guessed by me, there is no fixed value
)

get_mmr = function(l) {
    # l is an array of rank codes, such as [14, 44, 25]
    rank_codes = unlist(map(l, toString))
    unlist(as.integer(rank2mmr[rank_codes]))
}

read_file = function(filename) {
    try({
        json = jsonlite::read_json(filename)
        return(tibble(
            match_id = json$match_id,
            radiant_win = json$radiant_win,
            radiant_ranks = list(get_mmr(json$radiant_ranks)),
            dire_ranks = list(get_mmr(json$dire_ranks)),
            rank_n = length(json$radiant_ranks)
        ))
    })
}


d = files %>%
    future_map_dfr(read_file, .progress = TRUE) %>%
    rowwise() %>%
    mutate(
        radiant_mean = mean(radiant_ranks),
        dire_mean = mean(dire_ranks),
        radiant_sd = sd(radiant_ranks),
        dire_sd = sd(dire_ranks),
        radiant_range = diff(range(radiant_ranks)),
        dire_range = diff(range(dire_ranks)),
        rad_adv_mean = (radiant_mean - dire_mean) / radiant_mean,
        rad_adv_sd = (radiant_sd - dire_sd) / radiant_mean, # MEAN used here!
        rad_adv_range = (radiant_range - dire_range) / radiant_mean # MEAN used here!
    )



### RANDOM FILTERS

d %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n)) # radiant -> 53.3% winrate

d %>% filter(abs(radiant_sd - dire_sd) > 500) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter(radiant_sd - dire_sd > 500) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter(radiant_sd - dire_sd < -500) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))

d %>% filter(rank_n == 5) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n)) # No strong signal

# ADVANTAGE IN MEAN IS CORRELATED WITH GREATER WIN RATE
d %>% filter( rad_adv_mean >= 0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_mean <= -0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_mean >= 0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_mean <= -0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))

# ... NOT THE SAME WITH SD
d %>% filter( rad_adv_sd >= 0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_sd <= -0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_sd >= 0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_sd <= -0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))

# ... NOR WITH RANGE
d %>% filter( rad_adv_range >= 0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_range <= -0.1) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_range >= 0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))
d %>% filter( rad_adv_range <= -0.2) %>% count(radiant_win) %>% ungroup() %>% mutate(freq = n/sum(n))



### RANDOM PLOTS

d %>%
    ggplot(aes(radiant_mean, group=radiant_win)) +
    geom_histogram(position='dodge') + facet_wrap(radiant_win ~ .)

d %>%
    ggplot(aes(x = radiant_mean, y = dire_mean, color = radiant_win)) +
    geom_point()

d %>%
    filter(radiant_mean / dire_mean > 1.5 || dire_mean / radiant_mean > 1.5) %>%
    ggplot(aes(x = radiant_mean, y = dire_mean, color = radiant_win)) +
    geom_point()

d %>%
    ggplot(aes(x = radiant_range, y = dire_range, color = radiant_win)) +
    geom_point()
