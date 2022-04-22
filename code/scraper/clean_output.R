library(tidyverse)

parseDate <- Vectorize(function (string) {
  if (is.na(string)) {
    return(string)
  }
  parts <- str_split(string, '\\s*(,|t/m|tot)\\s*')
  return(paste(unlist(parts), collapse = " tot "))
  # return(class(parts))
})

bees <- read_csv('output.csv', na = c('', 'n.b.', 'n.b', 'niet bekend', 'niet duidelijk')) %>%
  separate(`sub-familie/genus`, into = c('subfamilie2', 'genus2')) %>%
  mutate(
    familie = coalesce(familie, famillie),
    subfamilie = coalesce(`sub-familie`, subfamilie2),
    genus = coalesce(genus, `/genus`, genus2),
    Engels = coalesce(Engels, `Engelse naam`),
    Nederlands = soortnaam,

    lengte = coalesce(lengte, `lengte V & M`, `lengte V&M`, Lengte),
    `lengte V` = coalesce(
      `lengte V`, `Lengte V`, `lengte v`,
      `Lengte werkster`, `lengte werkster`, `lengte werkster V`, `Lengte W`,
      lengte
    ),
    `lengte M` = coalesce(
      `lengte M`, `Lengte M`, `Lenge M`,
      `Lengte dar`, `lengte dar M`, `lengte dar`,
      lengte
    ),
    `lengte K` = coalesce(
      `Lengte koningin`, `Lengte Koningin`, `lengte K`
    ),
    `lengte V` = gsub(' ?mm$', gsub(',', `lengte V`, replacement = '.'), replacement = ''),
    `lengte M` = gsub(' ?mm$', gsub(',', `lengte M`, replacement = '.'), replacement = ''),
    `lengte K` = gsub(' ?mm$', gsub(',', `lengte K`, replacement = '.'), replacement = ''),

    `foerageergebied V` = coalesce(`foerageergebied V`, `fourageergebied V`, foerageergebied, vliegbereik),
    `foerageergebied M` = coalesce(`foerageergebied M`, `fourageergebied M`, foerageergebied, vliegbereik),
    `foerageergebied V` = gsub(' meter$', `foerageergebied V`, replacement = ''),
    `foerageergebied M` = gsub(' meter$', `foerageergebied M`, replacement = ''),
    
    vliegtijd = parseDate(
      coalesce(vliegtijd, paste(`vliegtijd 1`, `vliegtijd 2`, sep = ' en '))
    ),
    `hoofdvliegtijd V` = parseDate(
      coalesce(`hoofdvliegtijd V`, paste(
        coalesce(`hoofdvliegtijd 1 V`, `hoofdvliegtijd V 1`),
        `hoofdvliegtijd 2 V`,
        sep = ' en '
      ))
    ),
    `hoofdvliegtijd M` = parseDate(
      coalesce(`hoofdvliegtijd M`, paste(
        coalesce(`hoofdvliegtijd 1 M`, `hoofdvliegtijd M 1`),
        `hoofdvliegtijd 2 M`,
        sep = ' en '
      ))
    ),
    `hoofdvliegtijd K` = parseDate(`hoofdvliegtijd K`)
  ) %>%
  select(
    nummer, familie, subfamilie, genus, species,
    Nederlands, Engels,
    vliegtijd, `hoofdvliegtijd V`, `hoofdvliegtijd M`, `hoofdvliegtijd K`,
    `lengte V`, `lengte M`, `lengte K`, `foerageergebied V`, `foerageergebied M`,
    nestkeuze, `sociaal gedrag`, bloembezoek,
    presentie, `aantal uurhokken`, `Rode lijst`, trend
  )

write_tsv(bees, 'output_clean.tsv')
