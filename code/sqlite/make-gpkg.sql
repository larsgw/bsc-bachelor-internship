-- Run "sqlite3 locations.gpkg"

-- Instantiate gpkg
SELECT load_extension('mod_spatialite');
SELECT EnableGpkgMode();
SELECT gpkgCreateBaseTables();
SELECT gpkgInsertEpsgSRID(28992);
CREATE TABLE spatial_ref_sys (
  srid       INTEGER NOT NULL PRIMARY KEY,
  auth_name  VARCHAR(256),
  auth_srid  INTEGER,
  srtext     VARCHAR(2048),
  proj4text  VARCHAR(2048)
);
INSERT INTO spatial_ref_sys SELECT
  srs_id AS srid,
  organization AS auth_name,
  organization_coordsys_id AS auth_srid,
  definition AS srtext,
  NULL
FROM gpkg_spatial_ref_sys;

-- Import data
CREATE TABLE locations(location TEXT PRIMARY KEY NOT NULL, longitude REAL, latitude REAL);
.mode csv
.import --skip 1 data/locations.csv locations
ALTER TABLE locations ADD COLUMN geom GEOMETRY;
SELECT EnableGpkgMode();
UPDATE locations SET geom = ST_Buffer(gpkgMakePoint(longitude, latitude, 28992), 1000);
SELECT gpkgAddSpatialIndex('locations', 'geom');
