import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './openapi.js';

/** `/docs`: Swagger UI, and `/docs/openapi.json`: the raw OpenAPI 3.1 spec. */
export function createDocsRouter(): Router {
  const spec = buildOpenApiSpec();
  const router = Router();
  // The global CSP upgrades requests to https, which breaks the UI's assets over plain-http dev servers.
  router.use(helmet.contentSecurityPolicy({ directives: { 'upgrade-insecure-requests': null } }));
  router.get('/openapi.json', (_req, res) => res.json(spec));
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'ProjectX API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tryItOutEnabled: true },
    }),
  );
  return router;
}
