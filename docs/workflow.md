## Git Workflow

- `master`: Protected, release-ready.
- `develop`: Integration branch for ongoing work.
- `feature/<ticket-id>-<short-name>`: Short-lived branches.
- Always open a PR from `feature/*` → `develop`.
- Squash-merge preferred; keep commit messages referencing ticket IDs.
