import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  API: DurableObjectNamespace<CompassApi>;
  ASSETS: Fetcher;
  ASK_PER_IP: RateLimit;
  ASK_GLOBAL: RateLimit;
  ANTHROPIC_API_KEY: string;
}

/** The Node API (Hono + PGlite) from `server/`, running as a Cloudflare container. */
export class CompassApi extends Container<Env> {
  defaultPort = 3001;
  sleepAfter = '20m';

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    super(ctx, env);
    this.envVars = { HOST: '0.0.0.0', PORT: '3001', ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
  }
}

const tooMany = () =>
  Response.json({ error: 'Too many questions right now. Wait a minute and try again.' }, { status: 429 });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // Every question spends the API key, so cap them per visitor and for the whole site.
    if (request.method === 'POST' && url.pathname === '/api/ask') {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      if (!(await env.ASK_PER_IP.limit({ key: ip })).success) return tooMany();
      if (!(await env.ASK_GLOBAL.limit({ key: 'all' })).success) return tooMany();
    }

    // One instance holds the database, so every request goes to the same container.
    // A cold start seeds the database first, so wait for the port instead of failing the request.
    const api = getContainer(env.API);
    await api.startAndWaitForPorts({ cancellationOptions: { instanceGetTimeoutMS: 60_000, portReadyTimeoutMS: 60_000 } });
    return api.fetch(request);
  },
} satisfies ExportedHandler<Env>;
