# Integration Test Pattern

Integration tests belong in this folder and should use helpers from `test/setup`.

Rules:

- Set `TEST_DATABASE_URL` to a disposable database before running integration tests.
- Never point `TEST_DATABASE_URL` at local development or production data.
- Prefer testing one business rule per spec.
- Use factories from `test/setup/factories` for noisy setup data.
- Keep app bootstrapping in `test/setup/test-app.ts` so global pipes/prefixes match `main.ts`.

Example command:

```bash
bun run test:integration
```
