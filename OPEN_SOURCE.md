# Open Source Readiness

This repository is prepared for public release, but changing GitHub visibility
is a separate maintainer action.

## Public Release Boundary

Safe to publish:

- Next.js app source code.
- DeepSeek API integration code.
- Prompt construction logic.
- Anonymous analytics schema and feedback protocol, without production data.
- The downloadable `speak-zhouli` Skill package.
- Public images and static download files.
- README, license, and example environment variables.

Do not commit or publish:

- Real `.env`, `.env.local`, or `.dev.vars` files.
- API keys, Cloudflare API tokens, account IDs, service tokens, or session data.
- Private test logs under `test-runs/`.
- Local build output such as `.next/`, `.open-next/`, `.wrangler/`, and `node_modules/`.
- Production-only WAF, billing, alerting, or abuse-response notes.
- Generated B 站 Toy package, local Toy preview output, or Toy publishing credentials.

## Pre-Public Checklist

Run these checks immediately before setting the GitHub repository public:

```bash
npm run public:audit
npm test
npm run typecheck
npm run build
git status --short
```

Expected state:

- `npm run public:audit` reports no obvious secrets in tracked text files.
- Tests, typecheck, and build pass.
- `git status --short` is clean after committing.
- GitHub repository visibility is still private until a maintainer explicitly
  changes it.
