# Backend Architecture

The backend now follows a layered MVC-style structure:

- `controllers/`: HTTP adapters. Read `req`, call a service, and write `res`.
- `services/`: Business rules, validation, transactions, and orchestration.
- `repositories/`: Prisma data access. Keep database query details here.
- `middleware/`: Cross-cutting request concerns such as authentication.
- `utils/`: Shared infrastructure such as `HttpError` and async controller wrappers.

Request flow:

```text
Express route -> Middleware -> Controller -> Service -> Repository -> Prisma
```

Testing guideline:

- Unit test services by injecting mocked repositories.
- Keep controller tests focused on HTTP status and payload mapping.
- Keep repository tests as integration tests against a test database.

New API work should avoid putting Prisma calls or business decisions directly in controllers.
