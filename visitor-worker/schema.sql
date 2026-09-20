CREATE TABLE IF NOT EXISTS visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photo_likes (
  visitor_hash TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visitor_hash, photo_id)
);

CREATE INDEX IF NOT EXISTS photo_likes_photo_id
ON photo_likes (photo_id);
