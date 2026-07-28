# FlashForge 🎴

**Create, revise, and print classroom flashcards quickly.**

FlashForge is a teacher-focused React application for building printable flashcard decks. The core editor stores decks locally in the browser and works without an account. Optional serverless endpoints power AI-assisted deck creation, image search, and provider integrations.

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Flashcard editing

- Create and organize multiple flashcard sets
- Add front and back text, images, and card-specific styling
- Reorder cards with drag and drop
- Use single-sided or double-sided layouts
- Position and zoom images inside cards
- Auto-save work in browser storage
- Download and restore local backups
- Save and restore backup files through Google Drive

### Printing

- A4 and US Letter paper sizes
- Portrait and landscape orientation
- 1, 2, 4, 6, 8, 9, 10, or 12 cards per page
- Duplex long-edge and short-edge layouts
- Optional cut lines, borders, and ink-saving styles
- Browser-native printing and PDF export

### AI-assisted deck creation

The optional Flashcard Agent can create or revise deck content using an OpenAI-compatible provider chosen by the user.

- Bring your own API key (BYOK)
- Choose a provider base URL and model
- Generate text first, then fetch images with visible progress
- Cancel an active run while preserving completed work
- Revise existing cards without replacing the entire deck
- Browse compatible models where supported

### Image search

FlashForge supports a provider registry rather than relying on HTML scraping:

| Provider | Credentials | Typical use |
|---|---|---|
| Brave Search | API key | Broad web-relevant image results |
| Google Custom Search | API key and search engine ID | Broad web image search |
| Pexels | API key | Stock photography |
| Pixabay | API key | Stock photos and illustrations |
| Openverse | None | Creative Commons fallback |

Automatic provider order is:

**Brave → Google → Pexels → Pixabay → Openverse**

Only providers with configured credentials are included, except Openverse, which is always available as the final fallback.

> Image search results may have different licenses and usage restrictions. Review the source and license before redistributing or commercially using an image.

## Architecture

FlashForge uses a hybrid architecture:

- The React editor, deck management, card design, and browser storage run client-side.
- Vercel-compatible serverless functions under `api/` handle optional AI and image-provider requests.
- Provider credentials can be configured server-side through environment variables or supplied by the user through BYOK settings.
- No account or hosted database is required for ordinary local use.

### Main directories

```text
api/                     Optional serverless AI and image-search endpoints
scripts/                 Manual smoke-test utilities
src/components/          Application and UI components
src/lib/                 Storage, printing, AI, image, and deck utilities
src/test/ and api tests/ Automated regression and endpoint tests
.github/workflows/       Continuous integration
```

## Privacy and credentials

FlashForge does not ship with shared AI or image-search credentials.

- Decks and settings are stored in the browser unless the user explicitly exports or backs them up.
- BYOK credentials are stored in browser `localStorage`.
- A BYOK credential is sent only when a user invokes the corresponding provider-backed feature.
- Server-configured credentials are read from environment variables and are not returned to the browser.
- `GET /api/search-config` exposes provider availability as booleans only; it does not expose credential values.
- Google Drive support is manual backup and restore, not continuous cloud synchronization.

Browser storage is convenient but is not a permanent backup. Clearing site data, changing domains, or using another browser profile can make locally stored decks unavailable.

## Quick start

### Requirements

- Node.js 20 or newer
- npm

### Local development

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

The development configuration includes local handling for the optional serverless API routes.

### Quality checks

```bash
npm run lint
npm run build
npm test
```

### Production preview

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env.local` for local development, or configure the same values in your hosting environment.

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

All image providers are optional. Openverse works without credentials. Users may also supply provider credentials through the application instead of relying on server configuration.

Never commit a populated `.env` or `.env.local` file.

## Deploying to Vercel

1. Fork or clone the repository.
2. Import the repository into Vercel.
3. Add any optional provider credentials under **Project Settings → Environment Variables**.
4. Deploy.

The repository includes Vercel configuration for its serverless endpoints. A static-only deployment can run the core editor, but AI and provider-backed image-search features require compatible API routes.

## Using FlashForge

### Create a deck

1. Select **New Set**.
2. Enter a title.
3. Add cards manually or open the Flashcard Agent.
4. Add front and back text and optional images.
5. Adjust card design and print settings.

### Print or save as PDF

1. Open the preview or print view.
2. Select the paper size, orientation, cards per page, and duplex mode.
3. Select **Print**.
4. In the browser print dialog, use **Actual Size** or 100% scale.
5. Print directly or choose **Save as PDF**.

For duplex printing, test one sheet before printing a full deck because paper feed direction differs between printers.

### Back up decks

Use the backup tools to download a local backup file or save one to Google Drive. Google Drive integration provides explicit save and restore operations; it does not continuously synchronize edits between devices.

## AI and image-search behavior

The Flashcard Agent uses two phases:

1. **Text generation:** create or revise card text and image queries.
2. **Image retrieval:** fetch images per card with limited parallelism.

Cards whose image lookup fails are still preserved without an image. Canceling a run keeps cards and images already completed.

Images are embedded as compressed data URLs when possible so that printing does not depend on a temporary or hotlink-protected source URL. If embedding fails, FlashForge may retain the source URL instead.

## Testing

FlashForge uses Vitest for application and serverless endpoint tests.

```bash
npm test
npm run test:watch
```

The GitHub Actions workflow runs linting, build checks, and tests for pushes and pull requests.

A manual live-provider smoke test is available:

```bash
BRAVE_API_KEY=xxx \
PIXABAY_API_KEY=xxx \
PEXELS_API_KEY=xxx \
GOOGLE_API_KEY=xxx GOOGLE_CX=xxx \
AI_API_KEY=xxx AI_MODEL=gpt-4o-mini \
npm run smoke
```

Providers without credentials are skipped. Credential values are not printed. The live smoke test is not run in CI.

## Current limitations

- Data is primarily browser-local and is tied to the site origin and browser profile.
- Google Drive provides backup and restore, not live multi-device collaboration.
- Browser storage capacity varies; image-heavy decks can reach storage limits.
- Image search quality, rate limits, and availability depend on external providers.
- Web image results are not automatically guaranteed to be licensed for every use.
- Print alignment varies by browser and printer; test a single sheet first.
- FlashForge is currently a single-user application without shared real-time editing.

## Contributing

Bug reports, feature requests, and focused pull requests are welcome.

Before opening a pull request:

```bash
npm install
npm run lint
npm run build
npm test
```

Keep changes focused, preserve existing browser-storage compatibility where possible, and include regression tests for behavior changes.

For security-sensitive reports, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

FlashForge is released under the [MIT License](LICENSE).

## Credits

Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI, Phosphor Icons, and other open-source packages listed in `package.json`.
