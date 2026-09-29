// Validates request parts against Zod schemas. Parsed (coerced, stripped)
// values replace req.body; params/query are exposed on req.validated because
// Express 5 makes req.query a read-only getter.
export function validate({ body, params, query } = {}) {
  return (req, _res, next) => {
    req.validated = req.validated ?? {};
    if (params) req.validated.params = params.parse(req.params);
    if (query) req.validated.query = query.parse(req.query);
    if (body) {
      req.body = body.parse(req.body ?? {});
      req.validated.body = req.body;
    }
    next();
  };
}
