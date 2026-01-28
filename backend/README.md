# Backend scaffold

This folder contains the backend scaffolding for the Montessori family
training platform. It includes shared Python modules, Lambda handlers,
and infrastructure templates.

## Lambdas

- `auth_login` -> `POST /auth/login`
- `admin_families` -> `GET /admin/families`
- `public_events` -> `GET /events`

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `COGNITO_DOMAIN`: Cognito hosted UI domain.
- `COGNITO_CLIENT_ID`: Cognito app client id.
- `COGNITO_REDIRECT_URI`: Hosted UI redirect URI.
- `COGNITO_ADMIN_GROUP`: Admin group name (default: `admin`).
- `PUBLIC_API_KEY`: Optional API key for public endpoints.
- `EVENTS_LIMIT`: Default events page size (default: 100).
- `FAMILIES_LIMIT`: Default families page size (default: 200).

## Notes

- Admin routes assume API Gateway JWT authorizer is configured.
- Public events can optionally enforce an API key.
- Update `backend/infrastructure/templates/backend-api.yaml` to match
  your deployment environment.
