const { promises: fs, existsSync: exists } = require('fs')
const path = require('path')

const fetch = require('node-fetch')
const { JSDOM } = require('jsdom')
const { parse: json2csv } = require('json2csv')

const BASE_URL = 'https://www.wildebijen.nl/'
const CACHE_FILE = path.join(__dirname, 'cache.json')
let cache = {}

// Utility for fetching pages and caching them
async function fetchApi (url) {
  if (cache[url]) {
    // console.error('Using cache...')
  } else {
    console.error('Fetching over HTTP...')
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    cache[url] = await response.text()
  }
  return (new JSDOM(cache[url])).window.document
}

async function main () {
  if (exists(CACHE_FILE)) {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'))
  }

  const taxa = {}
  const parentTaxa = { subfamilies: {}, families: {} }

  // Get the main page. This lists the genera
  const index = (await fetchApi(BASE_URL + 'wildebijen.html'))
    .querySelectorAll('.content table tr:not(:first-child) td:nth-child(4) a')

  for (const genus of index) {
    // Skip Apis (no wild bees in the Netherlands)
    if (genus.textContent === 'Apis') {
      continue
    }

    // Get the list of species from the page
    const genusUrl = BASE_URL + genus.getAttribute('href')
    const genusIndex = (await fetchApi(genusUrl))
      .querySelector('.content + .content table:first-child, .kop + .content table:nth-child(2)')
      .querySelectorAll('tr:not(:first-child)')

    for (const speciesRow of genusIndex) {
      const nummer = speciesRow.querySelector('td:last-child').textContent
      const species = speciesRow.querySelector('td:nth-child(2) a')

      // No info page available
      if (!species) { continue }

      // Sometimes the species info page URL has a typo; these are
      // corrected in a map below
      let speciesUrl = BASE_URL + species.getAttribute('href')
      speciesUrl = urlMap[speciesUrl] || speciesUrl
      // Fetch species info page
      const speciesInfo = await fetchApi(speciesUrl)

      // Get the list of keys and the list of values
      let [keys, values] = Array.from(speciesInfo
        .querySelector('.kop + .content table tr:first-child')
        .querySelectorAll('td:nth-child(2) h2 > b, td:nth-child(3) h2')
      ).map(list => list.innerHTML
        // Collapse whitespace
        .trim()
        .replace(/\s+/g, ' ')
        // Fix encoding problems
        .replace(/&amp;/g, '&')
        .replace(/F�rster/g, 'Förster')
        .replace(/P�rez/g, 'Pérez')
        .replace(/M�ller/g, 'Müller')
        .replace(/Herrich-Sch�f?ffer/g, 'Herrich-Schäffer')
        .replace(/ph�eum/g, 'pháeum')
        // Split on linebreaks
        .split(/ ?<br> ?/g)
      )

      // Sometimes the lists of keys and values do not line up;
      // this inserts empty values to correct for that based on
      // definitions in a list below
      if (speciesUrl.slice(BASE_URL.length, -5) in exceptions) {
        for (const exception of exceptions[speciesUrl.slice(BASE_URL.length, -5)]) {
          values.splice(exception, 0, '')
        }
      }

      // This pushes empty keys for the same reason
      if (reverseExceptions.has(speciesUrl.slice(BASE_URL.length, -5))) {
        keys.push(...Array(values.length - keys.length).fill(''))
      }

      // If the values still do not line up, log the page and the keys/values
      if (keys.length !== values.length) {
        console.log(speciesUrl.slice(BASE_URL.length, -5), keys.map((a, i) => [i, a, values[i]]))
        continue
      }

      const info = {}
      let last
      for (let [key, value] of keys.map((key, i) => [key, values[i]])) {
        // If the values do not line up, log the page and the keys/values
        if (key == null || value == null) {
          console.log(speciesUrl.slice(BASE_URL.length, -5), keys.map((a, i) => [i, a, values[i]]))
          continue
        }

        // Remove the colon at the end.
        key = key.replace(/:/, '')
        // Sometimes typos appear or alternative spellings are used;
        // this corrects for that.
        key = fieldAliases[key] || key
        // (Crudely) remove HTML from the values
        value = value.replace(/<([^"]|".+?")+?>/g, '')

        // Add the key-value pair to the info object.
        if (key) {
          info[key] = value
          last = key
        // (Combines subsequent values if key is missing)
        } else if (value) {
          if (info[last]) {
            info[last] += ' ' + value
          } else {
            info[last] = value
          }
        }
      }

      // Add missing parentheses at end of species names
      if (info.species && info.species.match(/\([^)]*$/)) {
        info.species = info.species + ')'
      }

      // Split 'sub-familie/genus' field
      if (info['sub-familie/genus']) {
        const [subfamilie, genus] = info['sub-familie/genus'].split('/')
        Object.assign(info, { subfamilie, genus })
        delete info['sub-familie/genus']
      }

      // Combine multigenerational times
      if (info['vliegtijd 1']) {
        info.vliegtijd = [
          info['vliegtijd 1'],
          info['vliegtijd 2']
        ].filter(Boolean).join(' en ')
        delete info['vliegtijd 1']
        delete info['vliegtijd 2']
      }

      if (info['hoofdvliegtijd 1 V']) {
        info['hoofdvliegtijd V'] = [
          info['hoofdvliegtijd 1 V'],
          info['hoofdvliegtijd 2 V']
        ].filter(Boolean).join(' en ')
        delete info['hoofdvliegtijd 1 V']
        delete info['hoofdvliegtijd 2 V']
      }

      if (info['hoofdvliegtijd 1 M']) {
        info['hoofdvliegtijd M'] = [
          info['hoofdvliegtijd 1 M'],
          info['hoofdvliegtijd 2 M']
        ].filter(Boolean).join(' en ')
        delete info['hoofdvliegtijd 1 M']
        delete info['hoofdvliegtijd 2 M']
      }

      // Add defaults when relevant
      info['lengte V'] = info['lengte V'] || info.lengte
      info['lengte M'] = info['lengte M'] || info.lengte
      info['foerageergebied V'] = info['foerageergebied V'] || info.foerageergebied
      info['foerageergebied M'] = info['foerageergebied M'] || info.foerageergebied

      // Standardize date range formatting
      for (const key of ['vliegtijd', 'hoofdvliegtijd V', 'hoofdvliegtijd M', 'hoofdvliegtijd K']) {
        if (info[key]) info[key] = info[key].replace(/\s*(,|t\/m|tot)\s*/, ' tot ')
      }

      // Standardize length range formatting
      for (const key of ['lengte V', 'lengte M', 'lengte K']) {
        if (info[key]) info[key] = info[key].replace(/,/g, '.').replace(/ ?mm$/, '')
      }

      // Standardize foraging range formatting
      for (const key of ['foerageergebied V', 'foerageergebied M']) {
        if (info[key]) info[key] = info[key].replace(/meter$/, '')
      }

      // Standardize empty fields
      for (const key in info) {
        if (emptyFields.has(info[key])) info[key] = undefined
      }

      // Check the numbers
      if (/^\d+$/.test(nummer) && info.nummer !== nummer) {
        info.nummer = nummer
      }

      taxa[info.species] = { info }
      if (info.subfamilie) { parentTaxa.subfamilies[info.genus] = info.subfamilie }
      if (info.familie) { parentTaxa.families[info.subfamilie ] = info.familie}

      // Extract plant and parasite info
      const secondTable = speciesInfo
        .querySelector('.content + .content table:first-child, .kop + .content table:nth-child(2)')
      if (secondTable) {
        const [plants, parasites] = Array.from(secondTable.querySelectorAll('tr td:nth-child(4)'))
          .map(cell => cell.innerHTML.replace(/<(?!br>)([^"]|".+?")+?>|&nbsp;/g, '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .map(cell => cell.split(/ ?<br> ?/g).filter(Boolean))
        Object.assign(taxa[info.species], { plants, parasites })
      }
    }
  }

  for (const taxon in taxa) {
    if (!taxa[taxon].info.subfamilie) {
      taxa[taxon].info.subfamilie = parentTaxa.subfamilies[taxa[taxon].info.genus]
    }
    if (!taxa[taxon].info.familie) {
      taxa[taxon].info.familie = parentTaxa.families[taxa[taxon].info.subfamilie]
    }
  }

  await fs.writeFile('output.json', JSON.stringify(taxa, null, 2))

  const taxaInfo = Object.values(taxa).map(taxon => taxon.info)
  await fs.writeFile('output-info.json', JSON.stringify(taxaInfo, null, 2))

  await fs.writeFile('output.csv', json2csv(taxaInfo, {
    fields: [
      'nummer', 'familie', 'subfamilie', 'genus', 'species',
      'Nederlands', 'Engels',
      'vliegtijd', `hoofdvliegtijd V`, `hoofdvliegtijd M`, `hoofdvliegtijd K`,
      `lengte V`, `lengte M`, `lengte K`, `foerageergebied V`, `foerageergebied M`,
      'nestkeuze', `sociaal gedrag`, 'bloembezoek',
      'presentie', `aantal uurhokken`, `Rode lijst`, 'trend'
    ]
  }))
}

const emptyFields = new Set(['n.b.', 'n.b', 'niet bekend', 'niet duidelijk'])

const exceptions = {
  andrena_chrysosceles: [11, 19],
  andrena_humilis: [16],
  andrena_mitis: [27],
  andrena_pandellei: [28, 29, 30, 31],
  biggenkruidgroefbij: [1, 18],
  donkere_tuinhommel: [2],
  gele_hommel: [21],
  geurgroefbij: [1],
  grashommel: [19],
  grotebandgroefbij: [1],
  grote_kegelbij: [10],
  grotezijdebij: [19, 20],
  heidehommel: [10, 18],
  heidezandbij: [17],
  hoplitis_adunca: [31],
  hoplitis_anthocopoides: [10, 27],
  hoplitis_claviventris: [2, 28],
  hoplitis_leucomelana: [2, 28],
  hoplitis_papaveris: [28],
  hoplitis_ravouxi: [26, 29],
  hoplitis_villosa: [10, 17, 29],
  hylaeus_brevicornis: [11],
  hylaeus_hyalinatus: [11],
  hylaeus_punctulatissimus: [5],
  kleineklokjesbij: [26],
  kleineroetbij: [21],
  klimopbij: [31],
  klokjesgroefbij: [1],
  knautiabij: [16],
  langkopsmaragdgroefbij: [1],
  lasioglossumalbipes: [1, 12],
  lasioglossum_laticeps: [1],
  Lasioglossum_minutissimum: [1],
  lasioglossumnit: [1],
  lasioglossum_pauxillum: [1],
  lasioglossum_sabulosum: [1],
  lasioglossum_sexnotatum: [1],
  lasioglossum_sexstrigatum: [1],
  lasioglossum_tarsatum: [6],
  lathyrusbij: [8],
  mattebandgroefbij: [5, 21],
  nepetabij: [5],
  nomada_argentata: [5, 11],
  nomada_armata: [5, 11],
  nomada_flava: [10],
  nomada_fucata: [10],
  nomada_integra: [11],
  nomada_leucophthalma: [11],
  nomada_marshamella: [10],
  nomada_obscura: [11],
  nomada_panzeri: [10],
  nomada_ruficornis: [10],
  nomada_succincta: [10],
  nomada_zonata: [10],
  osmia_aurulenta: [2, 30],
  osmia_bicolor: [29],
  osmia_bicornis: [30],
  osmia_caerulescens: [27],
  osmia_cornuta: [30],
  osmia_leaiana: [28],
  osmia_maritima: [17, 28],
  osmia_niveata: [18, 29],
  osmia_spinulosa: [2, 28],
  osmia_uncinata: [29],
  osmia_xanthomelana: [29],
  ranonkelbij: [18, 28],
  schorzijdebij: [17, 19],
  slankegroefbij: [1],
  sphecodes_ephippius: [27, 28],
  sphecodes_ferruginatus: [6],
  sphecodes_geoffrellus: [29],
  sphecodes_miniatus: [5, 12],
  sphecodes_pellucidus: [12],
  sphecodes_puncticeps: [29],
  Stelis_breviuscula: [26],
  stelis_minuta: [25],
  stelis_ornatula: [25],
  stelis_phaeoptera: [26],
  stelis_punctulatissima: [24],
  stelis_signata: [24],
  tweelobbigewolbij: [12],
  veenhommel: [18],
  vierkleurigekhommel: [11],
  vroege_zandbij: [22],
  wormkruidbij: [19],
  zlanghoornbij: [2],
  zuidelijke_klokjesbij: [29],
}

const reverseExceptions = new Set([
  'andoornbij',
  'andrena_agilissima',
  'andrena_apicata',
  'andrena_argentata',
  'andrena_barbilabris',
  'andrena_bicolor',
  'andrena_bimaculata',
  'andrena_carantonica',
  'andrena_chrysosceles',
  'andrena_cineraria',
  'andrena_fucata',
  'andrena_fulvago',
  'andrena_gravida',
  'andrena_helvola',
  'andrena_humilis',
  'andrena_labialis',
  'andrena_labiata',
  'andrena_marginata',
  'andrena_minutula',
  'andrena_minutuloides',
  'andrena_nigriceps',
  'andrena_nitida',
  'andrena_ovatula',
  'andrena_proxima',
  'andrena_ruficrus',
  'andrena_simillima',
  'andrena_subopaca',
  'andrena_synadelpha',
  'andrena_tarsata',
  'andrena_tibialis',
  'andrena_varians',
  'andrena_wilkella',
  'Coelioxys_afra',
  'coelioxys_aurolimbata',
  'duinkegelbij',
  'gewone_sachembij',
  'grijze_zandbij',
  'grote_kegelbij',
  'grote_koekoekshommel',
  'honingbij',
  'knautiabij',
  'osmia_parietina',
  'roodgatjebij',
  'sphecodes_gibbus',
  'sphecodes_reticulatus',
  'sphecodes_spinulosus', // not really but good enough
  'steenhommel',
  'vierbandgroefbij',
  'vroege_zandbij',
  'zandhommel',
  'zwartrossezandbij'
])

const urlMap = {
  'https://www.wildebijen.nl/Andrena_minutula.html': 'https://www.wildebijen.nl/andrena_minutula.html',
  'https://www.wildebijen.nl/Andrena_minutuloides.html': 'https://www.wildebijen.nl/andrena_minutuloides.html',
  'https://www.wildebijen.nl/Andrena_mitis.html': 'https://www.wildebijen.nl/andrena_mitis.html',
  'https://www.wildebijen.nl/Andrena_varians.html': 'https://www.wildebijen.nl/andrena_varians.html',
  'https://www.wildebijen.nl/coelioxys_alata.html': 'https://www.wildebijen.nl/Coelioxys_alata.html',
}

const fieldAliases = {
  famillie: 'familie',
  'sub-familie': 'subfamilie',
  '/genus': 'genus',
  'Engelse naam': 'Engels',
  soortnaam: 'Nederlands',

  'hoofdvliegtijd V 1': 'hoofdvliegtijd 1 V',
  'hoofdvliegtijd M 1': 'hoofdvliegtijd 1 M',

  'lengte V & M': 'lengte',
  'lengte V&M': 'lengte',
  'Lengte': 'lengte',

  'Lengte W': 'lengte V',
  'Lengte V': 'lengte V',
  'Lengte werkster': 'lengte V',
  'lengte v': 'lengte V',
  'lengte werkster': 'lengte V',
  'lengte werkster V': 'lengte V',
  
  'Lenge M': 'lengte M',
  'Lengte M': 'lengte M',
  'Lengte dar': 'lengte M',
  'lengte M': 'lengte M',
  'lengte dar M': 'lengte M',
  'lengte dar': 'lengte M',

  'Lengte koningin': 'lengte K',
  'Lengte Koningin': 'lengte K',

  'fourageergebied V': 'foerageergebied V',
  'fourageergebied M': 'foerageergebied M',
  vliegbereik: 'foerageergebied',
}

main().catch(console.error).finally(() => fs.writeFile(CACHE_FILE, JSON.stringify(cache)))
