CREATE TABLE poc_owners (id UUID PRIMARY KEY);
CREATE TABLE poc_slots (id UUID PRIMARY KEY, "ownerId" UUID NOT NULL REFERENCES poc_owners(id), position INTEGER NOT NULL CHECK(position>0), active BOOLEAN NOT NULL DEFAULT true, revision BIGINT NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2147483647), UNIQUE("ownerId",id));
CREATE UNIQUE INDEX poc_active_position ON poc_slots("ownerId",position) WHERE active=true;
CREATE TABLE poc_versions (id UUID PRIMARY KEY, "ownerId" UUID NOT NULL, "slotId" UUID NOT NULL, version INTEGER NOT NULL CHECK(version>0), raw TEXT NOT NULL CHECK(char_length(raw) BETWEEN 1 AND 256), FOREIGN KEY("ownerId","slotId") REFERENCES poc_slots("ownerId",id), UNIQUE("slotId",version));
CREATE TABLE poc_keys (id UUID PRIMARY KEY, "ownerId" UUID NOT NULL REFERENCES poc_owners(id), operation TEXT NOT NULL, digest TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE("ownerId",operation,digest));
