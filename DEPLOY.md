# Deploying FlashForge to Vercel

FlashForge can be deployed as a Vite application with Vercel-compatible serverless functions.

## Prerequisites

- A GitHub account
- A Vercel account
- A fork or clone of this repository

## Deploy from the Vercel dashboard

1. Push your copy of FlashForge to GitHub.
2. In Vercel, create a new project and import the repository.
3. Confirm the detected Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Add any optional provider credentials under **Project Settings → Environment Variables**.
5. Deploy.

The core editor can run without provider credentials. AI-assisted deck creation and credential-backed image search require the corresponding serverless routes and provider configuration.

## Environment variables

Use `.env.example` as the source of truth.

```dotenv
BRAVE_API_KEY=
PIXABAY_API_KEY=
PEXELS_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CX=

# Optional server-side default AI provider
# AI_API_KEY=
# AI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini
```

All values are optional. Openverse remains available without credentials.

Do not commit populated `.env` or `.env.local` files. Configure production secrets in Vercel rather than placing them in the repository.

## Deploy with the Vercel CLI

```bash
npm install
npm run lint
npm run build
npm test

npx vercel
```

To deploy the selected project to production:

```bash
npx vercel --prod
```

Using `npx` avoids requiring a global Vercel CLI installation.

## Local verification

Run the same checks expected by CI before deployment:

```bash
npm install
npm run lint
npm run build
npm test
```

Start the development environment with:

```bash
npm run dev
```

For a production-style local preview:

```bash
npm run build
npm run preview
```

## Automatic deployments

When the Vercel project is connected to GitHub, Vercel can create production deployments from the configured production branch and preview deployments for pull requests. Exact behavior depends on the project's Git and deployment settings.

## Troubleshooting

### Build failure

- Reproduce the failure with `npm run build` locally.
- Confirm the deployment uses a supported Node.js version.
- Check that `package-lock.json` is committed and current.
- Review the Vercel build log for the first actual error rather than later cascading failures.

### API route failure

- Confirm the route exists under `api/`.
- Verify required provider credentials are configured in the correct Vercel environment.
- Check function logs for provider authentication, rate-limit, timeout, or response-format errors.
- Confirm `vercel.json` still includes the required serverless-function settings.

### AI provider failure

- Verify the OpenAI-compatible base URL and model name.
- Confirm the selected provider accepts the expected chat-completions request format.
- Check whether the provider returned an authentication error, rate limit, refusal, timeout, or unsupported response shape.

### Image search failure

- Confirm at least one credential-backed provider is configured, or allow Openverse fallback.
- Verify API-key restrictions and quotas with the provider.
- Check whether the remote image host blocks embedding or hotlink access.

### Browser data appears missing

FlashForge stores decks by site origin and browser profile. A preview deployment, production deployment, custom domain, and localhost are separate storage locations. Export a backup before changing domains or clearing browser data.

## Dependency policy

Dependabot intentionally avoids unsupported major ESLint upgrades while the installed React Hooks ESLint plugin requires the current major line. Revisit the ignore rule once the dependency ecosystem supports the newer ESLint major version.

## Hosting costs and limits

Hosting plans, quotas, and serverless limits can change. Check the current Vercel plan documentation for bandwidth, build, function-duration, and commercial-use terms before relying on a particular quota.
