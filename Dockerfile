# The Compass API (server/) for Cloudflare Containers.
FROM node:24-slim

WORKDIR /app

# Install only the server's runtime dependencies, at the versions the root package.json pins.
COPY package.json /tmp/root-package.json
RUN node -e "\
  const deps = require('/tmp/root-package.json').dependencies; \
  const names = ['@anthropic-ai/sdk', '@electric-sql/pglite', 'hono', '@hono/node-server']; \
  const pkg = { private: true, type: 'module', dependencies: Object.fromEntries(names.map((n) => [n, deps[n]])) }; \
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));" \
  && npm install --omit=dev --no-audit --no-fund

COPY server ./server

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["node", "server/main.ts"]
