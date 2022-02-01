name = 'parties'

library(dplyr)
library(ggplot2)
library(jsonlite)
library(furrr)
library(tidyr)

plan(multisession, workers = 4)

input_folder = paste0("../data/matches/json/filtered/", name)
output_folder = paste0("outputs/", name)

dir.create(output_folder, showWarnings = FALSE, recursive = TRUE)

files = list.files(input_folder, pattern = ".*\\.json$", full.names = TRUE)

read_file = function(filename) {
    try({
        json = jsonlite::read_json(filename)
        return(tibble(
            match_id = json$match_id,
            radiant_win = json$radiant_win,
            win_parties = list(unlist(json$win_parties)),
            lose_parties = list(unlist(json$lose_parties))
        ))
    })
}

d = files %>%
    future_map_dfr(read_file, .progress = TRUE)

win = d$win_parties %>% unlist %>% table %>% sort
lose = d$lose_parties %>% unlist %>% table %>% sort

d2 = inner_join(
        tibble(party=names(win), win),
        tibble(party=names(lose), lose)
    ) %>%
    mutate(sample_size = win + lose) %>%
    filter(win + lose > 100 ) %>%
    mutate(win_pctl = win / (win + lose)) %>%
    mutate(party = forcats::fct_reorder(party, win_pctl))

gg = ggplot(d2, aes(x = party, y = win_pctl * 100 - 50, label = sample_size)) +
    geom_segment(aes(x = party, xend = party, y = 0, yend = win_pctl * 100 - 50)) +
    geom_point(aes(color = factor(nchar(as.vector(party)))), size=3) +
    geom_text(aes(
        y = ifelse(
            win_pctl * 100 - 50 > 0,
            win_pctl * 100 - 50 + 0.05,
            win_pctl * 100 - 50 - 0.05
        )
    ), hjust = 'outward', size = 2) +
    labs(
        title = "Winrate by party composition",
        subtitle = "Labels: party sample size",
        x = "Party composition",
        y = "Winrate variation %",
        caption = paste("Data collected over", length(files), "ranked and unranked games for patch 7.30. Source: opendota.com")
    ) +
    coord_flip() + 
    scale_color_brewer('Party size:', palette = 'Set1') +
    theme_grey(base_size = 7) +
    scale_y_continuous(limits = c(-2,2), expand = c(0.02,0.02)) + 
    theme(
        legend.position = c(0.957, 0.05),
        legend.justification = c(1, 0),
        legend.direction = "vertical",
        legend.key = element_blank()
        )

ggsave(paste0('outputs/', name, '/winrates.jpg'), plot = gg, width = 6, height = 6)
