/**
 * Cloudflare front for the hosted globe. The app is the repository's own
 * Docker image (Dockerfile, scripts/docker-start.mjs); this Worker runs it as
 * a Cloudflare Container and forwards every request to it, as the reverse
 * proxy README.md describes: the original Host is kept, and the proxy says
 * the visitor's connection was HTTPS. The container sleeps when idle and
 * starts again on the next visit.
 */
import { Container } from '@cloudflare/containers';

const PORT = 4173;
const NAME = 'globe';

export class GlobeContainer extends Container {
  defaultPort = PORT;
  sleepAfter = '15m';
  enableInternet = true;

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = {
      HOST: '0.0.0.0',
      PORT: String(PORT),
      // The hostnames the globe is served on (README: Sharing an instance).
      GEV_ALLOWED_HOSTS: env.GEV_ALLOWED_HOSTS || '',
    };
  }
}

export default {
  async fetch(request, env) {
    const stub = env.GLOBE.getByName(NAME);
    // The first visit after a sleep starts the dev server, which takes longer
    // than the library's 20-second default.
    await stub.startAndWaitForPorts({
      ports: PORT,
      cancellationOptions: { portReadyTimeoutMS: 180_000 },
    });
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Proto', 'https');
    const visitor = request.headers.get('CF-Connecting-IP');
    if (visitor) headers.set('X-Forwarded-For', visitor);
    return stub.fetch(new Request(request, { headers }));
  },
};
