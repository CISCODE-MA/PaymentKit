# Contributing to @ciscode/paymentkit

This document describes the basic workflow and commit conventions for this repo.

---

## Branch & Flow

- Default branches:
  - `develop`: integration branch (feature PRs target this)
  - `master`: release branch (semantic-release runs here)
- Feature branches:
  - `feature/<ticket-id>-<short-name>`
  - Example: `feature/312-add-stripe-gateway`

Flow:

1. Create feature branch from `develop`
2. Open PR → `develop`
3. CI must be green (lint, test, build)
4. Merge to `develop`
5. When ready to release: merge `develop` → `master` (via PR)
6. Push to `master` triggers semantic-release and npm publish

---

## Commit Message Convention (Conventional Commits)

Format:

```text
<type>(optional-scope): <short description>

[optional body]

[optional footer]
``` 

## Types 

```text 
Use these types:
	•	feat: new feature (triggers a new release)
	•	fix: bug fix (triggers a new release)
	•	perf: performance improvement
	•	refactor: internal refactor (no behavior change)
	•	docs: documentation only
	•	test: tests only
	•	chore: tooling / CI / build changes
```

--- 

## Scopes 

```text 
Use scopes to indicate the area:
	•	core: domain models, ports, services
	•	gateways: Stripe/PayPal/Adyen adapters
	•	nest: NestJS module and integration
	•	common: shared types, errors, utils
	•	ci: CI/CD config
``` 

**Examples**

```bash 
feat(core): add unified payment request type
fix(gateways): correct Stripe refund mapping
chore(ci): add PR validation workflow
docs: document PaymentKitModule usage
refactor(nest): simplify module registration
``` 

--- 

## Breaking Changes 

For breaking changes, either: 

1.	Add ! after the type:

```text
feat(core)!: change payment result shape
``` 

2. Or add a BREAKING CHANGE footer: 

```text 
feat(gateways): update gateway registration API

BREAKING CHANGE: PaymentKitModule.register options have changed
```
Semantic-release will use this to bump the version appropriately and include the note in the release.

--- 

## Test & Lint

*Before Pushing* 
```bash 
npm run lint 
npm test     # currently passes with --passWithNoTests in early stages
npm run build 
``` 

*PRs should be green on CI before merging.* 



