# redact/calc

A small, good-looking calculator built to try out [TanStack Redact](https://tanstack.com/blog/introducing-tanstack-redact), a smaller browser-side replacement for React and React DOM.

**Live:** https://calc.richardthornton.com

The app is written as ordinary React (`useReducer`, `useEffect`, `react-dom/client`). At build time the Redact Vite plugin points every `react` / `react-dom` import at Redact, so **no React code ships to the browser**. The whole app's JavaScript is about **15 KB gzipped**.

## Features

- Standard operator precedence (`2 + 3 × 4 = 14`) with a live `= …` preview as you type
- Float noise rounded away (`0.1 + 0.2 = 0.3`) and exponent notation for very large or very small numbers
- Repeated `=` repeats the last operation; `±`, `%` and backspace
- Full keyboard support: digits, `+ - * /`, `Enter`/`=`, `Backspace`, `Esc` clears, `%`
- Tap the display to copy the result
- Light and dark themes that follow the system, reduced-motion support, screen-reader labels and live announcements

## Stack

| Piece    | Choice                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------- |
| UI       | React APIs, rendered by `@tanstack/redact` with the `nano` preset (no optional features needed)      |
| Build    | Vite + TypeScript                                                                                    |
| Tests    | Vitest. The calculator engine is a pure reducer in [`src/calc/engine.ts`](src/calc/engine.ts)        |
| Hosting  | Cloudflare Workers static assets (assets-only, no server code)                                       |
| Fonts    | Geist / Geist Mono, self-hosted via Fontsource                                                       |

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev        # Vite dev server
npm test           # engine unit tests
npm run preview    # production build served by Wrangler locally, with the real headers
```

## Deployment

The site is a [Cloudflare Worker with static assets](https://developers.cloudflare.com/workers/static-assets/). `wrangler.jsonc` attaches it to `calc.richardthornton.com` as a **Custom Domain**. Wrangler creates the DNS record and TLS certificate for you, so you don't add any DNS records by hand.

### One-time setup

1. **Make sure `richardthornton.com` is a zone in your Cloudflare account** (Cloudflare dashboard → *Websites*). If it already uses Cloudflare nameservers, nothing to do. A Custom Domain only works on a zone in the same account.
2. **Remove any existing `calc` DNS record** (DNS → Records). If a `calc` CNAME/A record already exists, the deploy will refuse to overwrite it.
3. **Deploy once from your machine:**
   ```sh
   npx wrangler login
   npm run deploy
   ```
   Wrangler builds, uploads `dist/`, and creates the `calc.richardthornton.com` Custom Domain. You'll see it under *Workers & Pages → redact-calc → Settings → Domains & Routes*, and a proxied `calc` record appears in DNS. The certificate usually goes live within a minute or two.

### Continuous deployment (optional)

`.github/workflows/deploy.yml` tests, builds, and deploys every push to `main`. To turn it on:

1. Create an API token: Cloudflare dashboard → *My Profile → API Tokens → Create Token* → **Edit Cloudflare Workers** template. Scope it to your account and the `richardthornton.com` zone.
2. In GitHub: *Settings → Environments → New environment* → `production`. Add two environment secrets:
   - `CLOUDFLARE_API_TOKEN`: the token above
   - `CLOUDFLARE_ACCOUNT_ID`: from the Workers & Pages overview sidebar

   Optionally restrict the environment to the `main` branch and/or require a reviewer.

The token is the only secret this project has.

Until those secrets exist, the Deploy workflow will fail on push. That's harmless; CI still runs.

## Security

There is no backend and no data collection, but the site is still locked down:

- **Strict CSP** (`public/_headers`): `default-src 'none'`, same-origin scripts, styles and fonts only, no inline script or style, `frame-ancestors 'none'`, and Trusted Types enforced. (Redact sets styles through the CSSOM, so it works without `'unsafe-inline'`.)
- **HSTS**, `nosniff`, `X-Frame-Options: DENY`, a strict `Referrer-Policy`, a deny-all `Permissions-Policy`, and COOP/CORP same-origin
- **No `*.workers.dev` or preview URLs.** The Worker is only reachable on the custom domain.
- **CI** runs tests, a production build, and `npm audit` on every PR. Workflows use read-only tokens and actions pinned to commit SHAs.
- **Dependabot** watches npm and GitHub Actions weekly.
- Vulnerabilities: see [SECURITY.md](SECURITY.md).

## Notes on Redact

- Redact is pre-1.0 (this uses `0.2.3`), and the version is pinned exactly.
- Rendering is synchronous, which is a non-issue for an app this size.
- `vite.config.ts` uses `preset: 'nano'`, which strips context, Suspense, portals, hydration, etc. If you add a library that needs one of those, turn it back on via `features`, e.g. `redact({ preset: 'nano', features: { context: true } })`.

## License

[MIT](LICENSE)
