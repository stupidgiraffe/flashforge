# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability, exposed credential, or privacy problem.

Use GitHub's private vulnerability reporting feature for this repository when it is available. If private reporting is unavailable, contact the repository owner through their GitHub profile and provide only enough public information to establish a private communication channel.

Include:

- the affected component or endpoint;
- steps to reproduce the issue;
- the potential impact;
- any suggested mitigation;
- whether credentials or personal data may have been exposed.

Do not include live API keys, access tokens, private user data, or exploit details in a public issue.

## Scope

Security reports are especially useful for issues involving:

- exposure or unintended forwarding of BYOK credentials;
- server environment-variable leakage;
- cross-site scripting or unsafe rendered content;
- unauthorized Google Drive access;
- server-side request forgery or unsafe remote image fetching;
- dependency vulnerabilities with a demonstrated impact on FlashForge;
- accidental disclosure of locally stored deck data.

## Supported version

Security fixes are applied to the current `main` branch. The project does not currently maintain separate long-term-support release branches.
