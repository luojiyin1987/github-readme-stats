# Scripts

## generate-readme-cards

Generate static stats and top languages SVGs using the local card renderer.

Usage:
```
  node scripts/generate-readme-cards.js --username luojiyin1987
```

Optional environment variables:
- `PAT_1`: GitHub token used for API requests (required for live runs).
- `GITHUB_TOKEN`: Fallback token if `PAT_1` is not set.
- `GITHUB_USERNAME`: Username if `--username` is not provided.
- `OUTPUT_DIR`: Output directory (default: `generated`).
- `STATS_QUERY`: Stats card query string or URL (uses the API handler).
- `TOP_LANGS_QUERY`: Top languages query string or URL (uses the API handler).
- `STATS_OPTIONS`: JSON string for stats card options.
- `TOP_LANGS_OPTIONS`: JSON string for top languages card options.
- `DRY_RUN`: Set to `true` to skip API calls and use sample data (`false` disables it).

Smoke test:
```
node scripts/generate-readme-cards.smoke.js
```

## Profile statistics cards

The profile workflow uses the local stats API and top languages API.
It runs the stats API first.
It runs the top languages API after the stats API completes.
The API fetchers combine the query results before they render each SVG.

The workflow requires the `PAT_1` repository secret.
Use a token that has access only to data you can publish.

The workflow publishes `stats.svg`, `top-langs.svg`, and `meta.json`.
It writes these files to the `profile-stats` branch.
