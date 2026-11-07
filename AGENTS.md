# MeetFlow agent instructions

## Start with the existing project

- Read `docs/AI_HANDOFF.md`, `.cursor/rules/project-rules.mdc`, and any applicable directory instructions before working. Preserve their useful rules; explicit user instructions control the current scope. Surface unresolved conflicts before dependent work.
- Inspect the relevant code, callers, authorization, and tests before proposing a change. Check `git status` and preserve existing user changes and untracked files.
- Work on one narrowly scoped task at a time. Do not redesign, expand, refactor, rename files, or change routes, middleware, or deployment configuration unless explicitly requested.

## Preserve behavior and architecture

- Follow the existing Next.js App Router, TypeScript, rendering, and data-fetching conventions. Respect server/client boundaries; keep server-only code out of browser bundles and local filesystem paths out of runtime features.
- Preserve authentication, conference access boundaries, registration and abstract workflows, visual identity, multilingual behavior, accessibility, and mobile responsiveness.
- Use the existing Supabase client structure. Keep service-role access server-only, with appropriate API validation and authorization. Never disable RLS or expose privileged keys to clients.
- Preserve zero-fee registration behavior: free means no payment unless existing business rules explicitly specify otherwise. Explain SQL proposals and any environment-variable requirements before implementation; do not print variable values.

## Approval and data boundaries

- Never access or change production Supabase, Vercel, or GitHub without explicit user approval for the target and action, including read-only access. Ordinary coding requests do not authorize production access. Local Git inspection is allowed.
- Never apply migrations, execute database-changing SQL, delete data, commit, push, or deploy without explicit approval. Preparing a migration is separate from permission to run it.
- Do not run `supabase db push`, `supabase migration repair`, or other remote migration commands until a verified production migration baseline is explicitly approved. The production history table is absent, so those commands can create history and then execute local migration files. Commit the untracked migration `064` separately before any history entry for it. Migration `065` is already committed and was applied manually.
- Never expose secrets, API keys, tokens, credentials, or personal data in output, logs, documentation, or examples. Use synthetic test data. Do not dump environment files or application records.
- Identify the environment before running integration tests, scripts, or builds that could contact external services. If the target is unclear, stop that operation and report the blocker.

## Validation and reporting

- Run relevant, safe checks for the change. Available commands: `npm test -- --runInBand --runTestsByPath <test-file>`, `npm run lint`, `npm run build`, and `npm run test:coverage`. Choose only appropriate checks; inspect configuration before execution.
- For documentation-only work, review content, links, scope, and the diff; application tests are normally unnecessary.
- Report exactly what changed, which checks ran, their results, and what remains untested. Never describe a feature as working merely because code exists or a mocked test passes.
- Separate locally verified facts, user-reported facts, assumptions, and live-state unknowns. Repository migrations do not prove production state or migration-history entries.
- Report blockers and missing evidence instead of inventing configuration, results, or workarounds. Update the handoff when documentation changes are in scope, keeping exactly one recommended next task.
