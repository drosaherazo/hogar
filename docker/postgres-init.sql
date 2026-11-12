-- Separate database for the API test suite, so tests never touch development data.
CREATE DATABASE hogar_test OWNER hogar;
-- Scratch database where `pnpm db:check` replays the migrations to compare them with the schema.
CREATE DATABASE hogar_shadow OWNER hogar;
