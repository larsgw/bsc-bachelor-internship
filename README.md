# BSc Biology Internship

Code from my BSc Biology internship.

- [`code/sqlite/`](code/sqlite): Code and (minimal) instructions to calculate TOP10NL land type areas in a radius around a point with SQLite.
- [`code/scraper/`](code/scraper): Code attempt at scraping [wildebijen.nl](https://wildebijen.nl/), with varying success.
- [`code/analysis.Rmd`](code/analysis.Rmd): Code for the figures and statistical analyses included in the report.
- [`data/locations/`](data/locations): Input and output for [`code/sqlite/`](code/sqlite).
  - [`locations.csv`](data/locations/locations.csv):
    A CSV file with columns id/long/lat (coordinates in EPSG 28992)
  - [`locations-landuse-200.csv`](data/locations/locations-landuse-200.csv):
    Output of the SQLite code, with for each location, the sum of areas of a certain terrain type and qualifier within a radius of 200 m.
  - [`locations-landuse-500.csv`](data/locations/locations-landuse-500.csv):
    The same for a radius of 500 m.
  - [`locations-landuse-1000.csv`](data/locations/locations-landuse-1000.csv):
    The same for a radius of 1000 m.
