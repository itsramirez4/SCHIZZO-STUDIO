import http from 'http';
import { shell } from 'electron';

export const OAUTH_REDIRECT_PORT = 53682;
export const OAUTH_REDIRECT_PATH = '/callback';

export function redirectUri(): string {
  return `http://127.0.0.1:${OAUTH_REDIRECT_PORT}${OAUTH_REDIRECT_PATH}`;
}

export type OAuthRedirectResult = { code: string } | { error: string };

/**
 * Opens `authorizeUrl` in the user's SYSTEM browser (never an embedded BrowserWindow — Google
 * explicitly rejects OAuth from embedded webviews as an "unsafe user agent", and RFC 8252
 * recommends the system browser for every native app for the same reason), then waits on a
 * temporary loopback HTTP server for the provider's redirect back to `redirectUri()`. This is
 * the standard, documented pattern for OAuth in desktop apps — not something improvised.
 */
export function waitForOAuthRedirect(authorizeUrl: string, expectedState: string, timeoutMs = 120000): Promise<OAuthRedirectResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${OAUTH_REDIRECT_PORT}`);
      if (url.pathname !== OAUTH_REDIRECT_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>Listo — podés cerrar esta pestaña.</h2></body></html>');

      if (settled) return;
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      settled = true;
      clearTimeout(timer);
      server.close();

      if (error) {
        resolve({ error });
      } else if (!code || state !== expectedState) {
        resolve({ error: 'Respuesta inválida del proveedor (código o estado faltante)' });
      } else {
        resolve({ code });
      }
    });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      resolve({ error: 'Tiempo de espera agotado esperando la autorización' });
    }, timeoutMs);

    server.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ error: `No se pudo iniciar el servidor local en el puerto ${OAUTH_REDIRECT_PORT}: ${err.message}` });
    });

    server.listen(OAUTH_REDIRECT_PORT, '127.0.0.1', () => {
      shell.openExternal(authorizeUrl);
    });
  });
}
