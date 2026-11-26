# nakade

Interactive relocation discovery and planning platform — starting with Bulgaria.

**Discover your place → Try your life there → Plan your move.**

- Website: https://nakade.app
- Product context: [docs/product-context.md](docs/product-context.md)

## Status

Hackathon concept. The frontend skeleton ([apps/web](apps/web/README.md)) runs end to end on mock data; backend and data pipeline are not started yet.

## Hosting

The site is a Cloudflare Worker (static assets) named `nakade`, configured in [apps/web/wrangler.jsonc](apps/web/wrangler.jsonc) and served on `nakade.app` and `www.nakade.app` (`nakade-dev` → dev.nakade.app). See [docs/devops.md](docs/devops.md).

## Develop

```bash
pnpm install
pnpm dev      # frontend on http://localhost:5173, mocked API
```
