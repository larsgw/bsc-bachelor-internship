# Dependencies

  - [Node.js](https://nodejs.org/) & [npm](http://npmjs.com/)
  - `jsdom` and `json2csv` (installed with `npm install`)

# Usage

    node wildebijen.nl.js

This writes a number of files:

  - `output.csv` and `output-info.json` contain taxonomic and ecological data about the bees.
  - `output.json` contains the same, as well as information about related plants and parasitic bees.
  - `cache.json` contains the HTML pages that were scraped, for quicker debugging.
