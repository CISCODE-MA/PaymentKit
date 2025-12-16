# Contributing to PaymentKit

Thank you for your interest in contributing to **PaymentKit** 💙
Contributions of all kinds are welcome: bug fixes, improvements, documentation, and discussions.

---

## Project Philosophy

PaymentKit aims to:

- Simplify payment gateway integration for NestJS
- Provide a clean, unified API across gateways
- Keep gateway logic isolated and testable
- Avoid vendor lock-in and unnecessary SDK dependencies
- Favor correctness, safety, and clarity over shortcuts

Please keep these principles in mind when contributing.

---

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/CISCODE-MA/PaymentKit.git
cd PaymentKit
npm install
```

### 2. Branch Naming

Use descriptive branch names:

    •	feat/<short-description>
    •	fix/<short-description>
    •	docs/<short-description>
    •	refactor/<short-description>

Examples:

    •	feat/stripe-checkout-session
    •	fix/paypal-approve-link
    •	docs/readme-improvements

---

## Development Guidelines

    •	All code must be written in TypeScript
    •	Public APIs must remain backward-compatible unless explicitly discussed
    •	Do not introduce gateway SDKs unless absolutely necessary
    •	Prefer small, focused changes over large refactors
    •	Avoid committing secrets, API keys, or credentials

---

## Tests & Quality

Before submitting a pull request, make sure to run and pass :

```bash
npm run lint
npm run build
```

If you add or modify logic:

    •	Prefer unit tests for gateway-specific behavior
    •	Do not rely on live external API calls in tests

---

## Pull Requests

When Opening a PR:

    •	Clearly describe what was changed and why
    •	Keep PRs focused on a single concern
    •	Reference related issues if applicable
    •	Update documentation if behavior or APIs change

A maintainer may ask for changes or clarification before merging.

---

## What Not to Submit

    •	Breaking changes without prior discussion
    •	Large refactors unrelated to the issue being solved
    •	Experimental features without a clear use case
    •	Code copied from proprietary or incompatible licenses

---

## Questions or Ideas?

If you are unsure about a change or want to discuss an idea:
• Open a GitHub Issue
• Or start a GitHub Discussion

We’re happy to talk things through before you write code.
