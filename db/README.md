# Database Scripts — AI Language Journal

This folder contains the database schema definitions, initialization scripts, and migrations for the SQLite storage layer.

## Files
- `schema.sql`: DDL statements defining the tables (`entries`, `feedback`, `mistakes`) and indexes.
- `init_db.py`: Standalone Python script using the standard library `sqlite3` to initialize or recreate `journal.db`.

## Usage
To initialize a fresh database using the default location (`journal.db` at repository root):

```bash
python3 db/init_db.py
```

To initialize a database at a custom path:
```bash
python3 db/init_db.py path/to/custom.db
```
