# Minifeed.net

Community curated RSS reader.

## Development

### Local development

Env variables are in `.dev.vars`

```
npm install
npm run dev
npm run dev-remote
npx wrangler tail
npm run unused-exports
```

### Migrations

```
npx wrangler d1 migrations create minifeed MIGR_NAME
npx wrangler d1 migrations apply minifeed --local
npx wrangler d1 migrations list minifeed --local
```

Removing a migration from the list of applied:

```
npx wrangler d1 execute minifeed --local --command="DELETE FROM d1_migrations WHERE id=2"
```

### Show table info

`SELECT * FROM sqlite_schema WHERE name='favorites'`
`PRAGMA foreign_key_list('favorites');`

### DB visualization

Export schema:

```
npx wrangler d1 export minifeed --local --output=./db.sql --no-data
```

Can be used with e.g. https://www.drawdb.app/

### Deployment

```
npm run deploy
npx wrangler d1 migrations list minifeed --local
npx wrangler d1 execute minifeed --local --file=./data/fake_data.sql
npx wrangler d1 execute minifeed --local --command="SELECT * FROM Items"

npx wrangler d1 execute minifeed --command="SELECT COUNT(item_id) FROM Items"
```

### Useful commands

List of indexes:

```
SELECT name, type, sql FROM sqlite_schema WHERE type IN ('index');
```