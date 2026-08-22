# Release / push checklist

Before pushing a release candidate:

```bash
npm install --no-audit --no-fund
npm run validate
npx playwright install chromium
npm run test:browser
git status --short
git push -u origin main
```

`npm run test:browser` needs an environment where Chromium is permitted to navigate to the local fixture. If an execution sandbox blocks browser navigation, do not mark the test passed; run it on the GitHub Actions `browser-smoke` job or another unrestricted test runner.

The repository remote for this build is intended to be:

`https://github.com/aibotjock/gauntletloop.git`
