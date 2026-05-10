// tomato_app/src/main/sync/oauth-server.ts
import * as http from 'node:http';
import * as url from 'node:url';

export interface OAuthResult {
  code: string;
  error?: string;
}

export class OAuthServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private result: OAuthResult | null = null;
  private resolveResult: ((result: OAuthResult) => void) | null = null;

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code as string;
          const error = parsedUrl.query.error as string;

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>${error ? 'Authorization failed' : 'Authorization successful!'}</h1>
                <p>You can close this window now.</p>
              </body>
            </html>
          `);

          this.result = { code, error };
          this.resolveResult?.(this.result);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.listen(0, () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error('Failed to get port'));
        }
      });
    });
  }

  async waitForCallback(timeout: number = 60000): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
      this.resolveResult = resolve;

      setTimeout(() => {
        reject(new Error('OAuth timeout'));
        this.stop();
      }, timeout);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}
