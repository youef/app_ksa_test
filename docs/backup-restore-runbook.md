# Hayna — Backup and restore runbook

## Scope
Supabase PostgreSQL (Auth, profiles, questions, stories, messages, transactions), Storage buckets, and Vercel/GitHub deployment configuration. A Git repository is **not** a database or Storage backup.

## Preparation
1. Verify the Supabase project's available automatic backup/PITR entitlement in the dashboard. Do not assume PITR is enabled.
2. Enable daily encrypted database backups using Supabase managed backups or an approved secure external backup service. Keep copies in a separate account/project with restricted access. Set retention and confirm recovery-point and recovery-time objectives.
3. Back up Storage objects and metadata separately; PostgreSQL backups alone do not restore uploaded images.
4. Back up deployment configuration and secret *names* securely. Never commit secret values, service-role keys, or backup dumps to GitHub.
5. Document dependencies: database extensions, Edge Functions, cron schedules, Storage policies, Auth settings, environment variables, and third-party providers.

## Restore drill (staging only)
1. Provision an isolated staging Supabase project. Do not restore over production.
2. Restore a recent encrypted database snapshot and Storage snapshot into staging.
3. Apply schema migrations, Edge Functions and secrets using staging-only credentials.
4. Verify: table counts and key foreign keys; RLS isolation; login; one test question, message and story; story expiration; Storage cleanup and scheduled jobs.
5. Record snapshot timestamp, restore duration, missing assets, and rollback decisions.
6. Destroy test user data and rotate any credentials used in the drill.

## Guardrails
- No destructive operations in production as part of a drill.
- Financial/legal records may require longer retention than ephemeral stories.
- A restore is considered tested only after successful execution, not merely after writing this document.
- Recheck backups and perform a staging restore drill regularly (e.g., quarterly).
