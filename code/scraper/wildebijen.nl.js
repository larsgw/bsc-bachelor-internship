const { promises: fs, existsSync: exists } = require('fs')
const path = require('path')

const fetch = require('node-fetch')
const { JSDOM } = require('jsdom')

const BASE_URL = 'https://www.wildebijen.nl/'
const CACHE_FILE = path.join(__dirname, 'cache.json')
let cache = {}

async function fetchApi (url) {
  if (cache[url]) {
    console.error('Using cache...')
  } else {
    console.error('Fetching over HTTP...')
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    cache[url] = await response.text()
  }
  return (new JSDOM(cache[url])).window.document
}

const exceptions = {
  grotezijdebij: [19, 20],
  wormkruidbij: [19],
  schorzijdebij: [17, 19],
  klimopbij: [31],
  hylaeus_brevicornis: [11],
  hylaeus_hyalinatus: [11],
  hylaeus_punctulatissimus: [5],
  lasioglossumalbipes: [1, 12],
  geurgroefbij: [1],
  klokjesgroefbij: [1],
  slankegroefbij: [1],
  lasioglossum_laticeps: [1],
  mattebandgroefbij: [5, 21],
  grotebandgroefbij: [1],
  Lasioglossum_minutissimum: [1],
  langkopsmaragdgroefbij: [1],
  lasioglossumnit: [1],
  lasioglossum_pauxillum: [1],
  lasioglossum_sabulosum: [1],
  lasioglossum_sexnotatum: [1],
  lasioglossum_sexstrigatum: [1],
  lasioglossum_tarsatum: [6],
  biggenkruidgroefbij: [1, 18],
  kleineroetbij: [21],
  tweelobbigewolbij: [12],
  Stelis_breviuscula: [26],
  stelis_minuta: [25],
  stelis_ornatula: [25],
  stelis_phaeoptera: [26],
  stelis_punctulatissima: [24],
  stelis_signata: [24],
  grote_kegelbij: [10],
  lathyrusbij: [8],
  osmia_aurulenta: [2, 30],
  osmia_bicolor: [29],
  osmia_caerulescens: [27],
  osmia_cornuta: [30],
  osmia_leaiana: [28],
  osmia_maritima: [17, 28],
  osmia_niveata: [18, 29],
  osmia_bicornis: [30],
  osmia_spinulosa: [2, 28],
  osmia_uncinata: [29],
  osmia_xanthomelana: [29],
  hoplitis_adunca: [31],
  hoplitis_anthocopoides: [10, 27],
  hoplitis_claviventris: [2, 28],
  hoplitis_leucomelana: [2, 28],
  hoplitis_papaveris: [28],
  hoplitis_ravouxi: [26, 29],
  hoplitis_villosa: [10, 17, 29],
  nepetabij: [5],
}

const reverseExceptions = new Set([
  'vierbandgroefbij',
  'Coelioxys_afra',
  'coelioxys_aurolimbata',
  'osmia_parietina',
  'duinkegelbij',
  'andoornbij',
  'gewone_sachembij',
  'honingbij'
])

async function main () {
  if (exists(CACHE_FILE)) {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'))
  }

  const index = (await fetchApi(BASE_URL + 'wildebijen.html'))
    .querySelectorAll('.content table tr:not(:first-child) td:nth-child(4) a')
  const taxa = {}

  for (const genus of index) {
    const genusUrl = BASE_URL + genus.getAttribute('href')
    const genusIndex = (await fetchApi(genusUrl))
      .querySelectorAll('.content + .content table:first-child tr:not(:first-child) td:nth-child(2) a')

    for (const species of genusIndex) {
      let speciesUrl = BASE_URL + species.getAttribute('href')
      if (speciesUrl === 'https://www.wildebijen.nl/coelioxys_alata.html') {
        speciesUrl = 'https://www.wildebijen.nl/Coelioxys_alata.html'
      }
      const speciesInfo = await fetchApi(speciesUrl)

      let [keys, values] = Array.from(speciesInfo
        .querySelector('.kop + .content table tr:first-child')
        .querySelectorAll('td:nth-child(2) h2 > b, td:nth-child(3) h2')
      )
        .map(list => list.innerHTML
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/F�rster/g, 'Förster')
          .replace(/P�rez/g, 'Pérez')
          .replace(/ph�eum/g, 'pháeum')
          .split(/ ?<br> ?/g)
        )

      // special cases
      if (speciesUrl.slice(BASE_URL.length, -5) in exceptions) {
        for (const exception of exceptions[speciesUrl.slice(BASE_URL.length, -5)]) {
          values.splice(exception, 0, '')
        }
      } else if (reverseExceptions.has(speciesUrl.slice(BASE_URL.length, -5))) {
        keys.push('')
      } else if (keys.length !== values.length) {
        console.log(speciesUrl.slice(BASE_URL.length, -5), keys.map((a, i) => [i, a, values[i]]))
        continue
      }

      const info = {}
      let last
      for (let [key, value] of keys.map((key, i) => [key, values[i]])) {
        if (key == null || value == null) {
          console.log(speciesUrl.slice(BASE_URL.length, -5), keys.map((a, i) => [i, a, values[i]]))
          continue
        }

        key = key.replace(/:/, '')
        value = value.replace(/<([^"]|".+?")+?>/g, '')

        if (key) {
          info[key] = value
          last = key
        } else if (value) {
          if (info[last]) {
            info[last] += ' ' + value
          } else {
            info[last] = value
          }
        }

        if ((key || last) === 'species' && info.species.match(/\([^)]*$/)) {
          info.species = info.species + ')'
        }
      }

      taxa[info.species] = { info }

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

  await fs.writeFile('output.json', JSON.stringify(taxa, null, 2))
}

main().catch(console.error).finally(() => fs.writeFile(CACHE_FILE, JSON.stringify(cache)))
