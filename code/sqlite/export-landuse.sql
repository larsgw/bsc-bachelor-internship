-- Load top10nl data
ATTACH DATABASE 'data/top10nl_Terrein.gpkg' AS terrain;

-- Export data
.mode csv
.headers on
.output 'locations-landuse.csv'
SELECT
  locations.location,
  typelandgebruik,
  voorkomen,
  SUM(ST_Area(ST_Intersection(locations.geom, terrain.geom))) AS area
FROM locations, terrain.top10nl_terrein_vlak terrain
WHERE ST_Intersects(locations.geom, terrain.geom)
GROUP BY locations.location, typelandgebruik, voorkomen;
