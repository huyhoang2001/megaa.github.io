# Mega 6/45 and Power 6/55 Analytics

A local-first React and Vite dashboard for exploring historical Mega 6/45 and Power 6/55 results.

## Development

```bash
npm ci
npm run dev
```

Run validation and a production build:

```bash
npm test -- --run
npm run build
```

## Refresh lottery data

Both datasets are sourced from [NhanAZ-Data/vietlott-research](https://github.com/NhanAZ-Data/vietlott-research/tree/main/datasets).

```bash
npm run sync:data
```

The sync scripts validate draw counts, number ranges, uniqueness, bonus numbers, and jackpot values before replacing the bundled JSON files.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml`:

1. Deploys every push to `main`.
2. Refreshes both datasets daily at 21:30 Asia/Ho_Chi_Minh time.
3. Commits changed data using the GitHub Actions bot.
4. Runs the test suite and production build.
5. Publishes `dist` to GitHub Pages.

In the GitHub repository, open **Settings > Pages** and select **GitHub Actions** as the source. You can also run the workflow manually from the **Actions** tab.
