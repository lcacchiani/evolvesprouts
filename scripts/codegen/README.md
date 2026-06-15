# OpenAPI code generation (generalized)

This folder contains generic scripts for generating API clients from any
OpenAPI spec.

## Usage

1. Install Node.js (18+ recommended).
2. Run the codegen script with the desired generator.

Example:

```
./scripts/codegen/openapi_codegen.sh \
  --spec docs/api/public.yaml \
  --generator typescript-fetch \
  --output apps/public_www/src/types/generated
```

You can use any generator supported by OpenAPI Generator. For admin API types,
see `apps/admin_web` (`npm run generate:admin-api-types`). For public API types,
see `apps/public_www` (`npm run generate:public-api-types`).
