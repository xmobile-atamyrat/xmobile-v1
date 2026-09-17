// The HTTP origin and the WebSocket origin always describe the same deployment,
// so they are derived together here. Deriving the socket URL from NODE_ENV used
// to send staging to production's socket, because staging also runs a
// production build -- NEXT_PUBLIC_APP_ENV is the only flag that tells the two
// deployments apart.

// eslint-disable-next-line import/no-mutable-exports
let BASE_URL = '';
// eslint-disable-next-line import/no-mutable-exports
let WS_BASE_URL = '';

if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
  BASE_URL = 'https://xmobile.com.tm';
  WS_BASE_URL = 'wss://xmobile.com.tm';
} else if (process.env.NEXT_PUBLIC_APP_ENV === 'staging') {
  BASE_URL = 'http://dev.xmobile.com.tm';
  // Staging terminates no TLS, so the handshake has to stay plain `ws://`:
  // `wss://` against port 80 never completes.
  WS_BASE_URL = 'ws://dev.xmobile.com.tm';
} else {
  BASE_URL = `http://${process.env.NEXT_PUBLIC_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_PORT ?? 3000}`;
  // Local dev runs the socket on its own port, so it has to be configured
  // explicitly; falling back to '' resolves the socket against the page origin.
  WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? '';
}

export { WS_BASE_URL };

export default BASE_URL;
