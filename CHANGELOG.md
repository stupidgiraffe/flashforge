# Changelog

All notable changes to FlashForge are documented here.

## Unreleased

### Security

- AI API keys are no longer persisted for new users unless device storage is explicitly enabled.
- Public AI and image-search routes validate JSON shape and enforce bounded request bodies.
- Production AI provider base URLs must use public HTTPS hosts; localhost remains available only for local development.
- Authenticated AI requests reject provider redirects rather than following them to an unvalidated destination.
- Server-side image embedding validates outbound destinations and every redirect before fetching remote image bytes.
- API error responses remove raw provider diagnostic bodies and attach request IDs.
- Added Content Security Policy, Permissions Policy, anti-framing, MIME-sniffing, referrer, and cross-domain-policy headers.
- Added regression tests for oversized requests, malformed JSON, private/reserved networks, DNS-to-private resolution, IPv4-mapped IPv6 addresses, and unsafe redirects.

### Documentation

- Removed unsupported shared server-side AI environment-variable instructions. AI generation remains BYOK.
- Clarified browser-local credential behavior, public API boundaries, and distributed rate-limiting limitations.

### Deferred before a managed paid service

- Distributed rate limiting backed by durable shared state.
- Managed/shared AI credits and billing controls.
- Authentication, cloud synchronization, and account-level quotas.
- Complete image-license provenance and attribution export.
- Product rename and permanent-domain migration.

## Public release baseline

The current public-alpha baseline includes the browser-local editor, printable layouts, AI create/enhance/revise workflows, provider-aware image search, encrypted credential backup, Google Drive backup/restore, dark mode, mobile model browsing, revision recovery, and automated CI coverage.
