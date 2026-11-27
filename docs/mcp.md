# MCP server (AI apps)

`/api/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server. It lets a superuser work on product images from an AI app such as ChatGPT: generate an image in the chat, then put it on a product without leaving the chat.

Only **superusers** can connect. The role is read from the database on every request, so demoting or deleting the account cuts its AI apps off on their next call.

## Tools

| Tool                     | Changes the site | What it does                                                                             |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `search_products`        | no               | Finds products by name, brand or category. Includes out-of-stock and imageless products. |
| `get_product_images`     | no               | Lists a product's images in order, with 600px previews read from disk                    |
| `add_product_image`      | yes              | Downloads an image from the chat and adds it at a position (1 = main image)              |
| `reorder_product_images` | yes              | Takes the full list of current image keys in the new order, and nothing else             |
| `remove_product_image`   | yes              | Takes an image off the product and deletes its files. Refuses the last image             |
| `replace_product_image`  | yes              | Swaps one image for an image from the chat, at the same position. Deletes the old files  |

Every change is written to the activity log with `via: "mcp"` in its details, and the product's pages are revalidated. A removed or replaced image's original and both compressed copies are deleted, so its `/media` link stops working, unless another product (a soft-deleted one included, since it can be restored) still lists a file of the same name: `/media` serves the compressed copies by file name alone, so the name is what counts, whatever directory a stored path names. The admin product form follows the same rule, and deletes a removed image's files only once the save has gone through. There is no undo; the nightly image backup is the only copy. Images are named by their file name (their "key"); the AI never sees server paths. Each result carries its data twice, as `structuredContent` and as JSON text, so a client on a protocol version before structured content (2025-03-26 and older), or one that only shows the model text, still gets the ids and keys the other tools need.

Images come in through ChatGPT's `openai/fileParams`: ChatGPT hands the tool a short-lived link to its own file storage, and the server downloads it. The download is limited to `https://oaisdmntpr*.blob.core.windows.net` (ChatGPT's Azure storage, which the VM can reach), with no redirects, a 15 s timeout and a 10 MB cap. The bytes must be JPEG, PNG or WebP by content, at least 100px a side and at most 25 MP (about 100 MB decoded). They are decoded and re-encoded with sharp before anything is written, which drops metadata and anything that isn't pixels. At most two images are decoded at once; further calls wait their turn, so a burst of uploads can't run the 4 GB VM out of memory.

A link on any other host is refused and logged with `console.error`, which reaches Slack. If ChatGPT ever moves its storage, image uploads fail with that alert; add the new host to `ALLOWED_HOST` in `src/lib/mcp/imageDownload.ts`.

Claude and Gemini connect too (see [Connecting Claude](#connecting-claude) and [Connecting Gemini](#connecting-gemini)) but don't hand files to tools: Claude's custom connectors can't transfer files, and Google documents no way for Gemini to. So they get search_products, get_product_images, reorder_product_images and remove_product_image, without the two tools that take an image. Which app a client is (`chatgpt`, `claude`, `gemini` or `other`) is stored in its `MCP_CLIENTS` entry as `app`, never read from its callback host at request time. `yarn mcp:create-client-*` fills it from the callback host (chatgpt.com, claude.ai, oauth-redirect(-sandbox).googleusercontent.com); pass `--app` for any other host. An entry without `app` is invalid, and an invalid `MCP_CLIENTS` lets no client connect.

## Authentication

OAuth 2.1, as the MCP spec requires. The app is its own authorization server:

- Discovery: `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server` (rewrites in `next.config.mjs` to `src/pages/api/mcp/well-known/`).
- Clients: listed in `MCP_CLIENTS` in `.env`, a JSON array that `yarn mcp:create-client-prod` prints (see [Connecting ChatGPT](#connecting-chatgpt)). Each has a secret that the token endpoint requires; only its SHA-256 is in `.env`. Its redirect URIs must be https on `MCP_ALLOWED_REDIRECT_HOSTS` (default `chatgpt.com`, `claude.ai` and `oauth-redirect.googleusercontent.com`), all for one app unless `--app` is given. There can be at most 20 clients: the script refuses to print a list the server wouldn't load. The script refuses to run without its env file (`.env.local` or `.env`), since an unloaded `MCP_CLIENTS` would make it print a line that drops every existing client. Taking a client out of the list and restarting cuts off its connections.
- No dynamic client registration. The metadata names `/api/mcp/oauth/register` only because Gemini won't connect without one listed; it refuses every request and registers nothing. The redirect check can't tell your ChatGPT account from anyone else's, so with open registration a stranger could add xmobile as a connector in their own ChatGPT, name it "ChatGPT", and send a superuser the consent link; one click on **Allow** would give their chat write access. The client secret is what their connector lacks.
- Consent: `/oauth/authorize`, a page that uses the normal xmobile login. Neither it nor `/user/signin`, which sends a signed-in user on to it with a full page load, can be framed (`next.config.mjs` and the page set `X-Frame-Options` and `frame-ancestors`). The approval goes through `/api/mcp/oauth/approve` with the superuser's session token; cancelling goes through it too and needs a signed-in user, so nobody can have the server sign an `access_denied` for someone else's request.
- Tokens: `/api/mcp/oauth/token`. PKCE S256 is required. Access tokens last 15 minutes, refresh tokens 30 days and rotate on every use, and a connection ends 90 days after approval. The VM's link drops responses, and clients repeat requests (a retry after a lost answer, possibly after a backoff, or two calls racing). So within 5 minutes, the refresh token from before a rotation, or an authorization code traded again with the same PKCE verifier and client secret, gets the pair the connection holds now. The previous refresh token also gets it later, as long as that pair's access token has never been used (`McpGrant.accessUsedAt` is still empty): a client whose answer was lost, and who retries only on its next tool call, holds just the old token. Nothing is replaced, so whichever answer the client keeps works. Anything else ends the connection: the previous refresh token once the new pair is in use and the 5 minutes are over, any older one, or a code replayed without those conditions. An access token replaced by a refresh keeps working for those same 5 minutes (or until it would have run out, if sooner), so calls already on their way with it don't fail. A longer window would give a stolen previous refresh token longer to be used unnoticed. Gemini is the exception to rotation: Google's guide says a server "must avoid rotating the Refresh Token", so a Gemini connection keeps the refresh token it got first and each refresh renews only the access token (the same one again within 5 minutes).

Tokens have an `xmcp_` prefix. A connection's token pair is an HMAC of its id and a generation (the access expiry of the pair it was issued in), under a key derived from `ACCESS_TOKEN_SECRET`, which is how a repeated request gets the same pair without it being stored. The grant row stores the refresh token's generation (`refreshGeneration`) and when the current access token was issued (`accessIssuedAt`), so changing the 15-minute access lifetime doesn't change how existing connections are checked. A refresh token also names its connection and generation, so a genuine older token coming back can be recognised and its connection ended without keeping every old hash. Only their SHA-256 hashes are stored, in the one table this needs, `McpGrant` (a row per connection). Authorization codes aren't stored: each carries the approval sealed with AES-256-GCM, under a key derived from `ACCESS_TOKEN_SECRET`, and `McpGrant.authCodeHash` being unique makes each code single-use. Changing `ACCESS_TOKEN_SECRET` voids codes issued in the last 2 minutes and every refresh token, so each AI app has to connect again once its access token runs out (at most 15 minutes).

## Turning it on

In the VM's `.env`:

```bash
MCP_ENABLED=true
MCP_PUBLIC_ORIGIN=https://xmobile.com.tm
```

Restart the app, then check that nginx passes the discovery paths through to Next (expect JSON, not a 403 or 404):

```bash
curl -s https://xmobile.com.tm/.well-known/oauth-authorization-server
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://xmobile.com.tm/api/mcp
```

The second one should print `401`.

## Connecting ChatGPT

1. In ChatGPT: **Settings → Apps & Connectors → Advanced → Developer mode** on, then **Create**.
2. URL `https://xmobile.com.tm/api/mcp`, authentication **OAuth**. Open the advanced OAuth settings and copy the callback URL ChatGPT shows there.
3. On the VM, create a client for it:

   ```bash
   yarn mcp:create-client-prod --name ChatGPT --redirect-uri '<callback URL from step 2>'
   ```

   It prints a client ID and secret, once, and a new `MCP_CLIENTS` line that keeps the clients already there.

4. Replace the `MCP_CLIENTS` line in `.env` with the printed one and restart the app.
5. Paste the client ID and secret into ChatGPT's OAuth fields, with token auth method `client_secret_basic`. If ChatGPT offers dynamic client registration instead, don't use it: this server refuses it.
6. ChatGPT opens the xmobile consent page. Sign in as a superuser and press **Allow**.

If the consent page says the redirect_uri is not registered, ChatGPT is using a different callback URL than the one given in step 3. Create a new client with that URL. A lost secret also means a new client.

ChatGPT asks before running a tool that changes the site. Don't switch that off: a web page or file in the same chat could contain instructions that try to call the tools.

## Connecting Claude

Pro and Max: claude.ai → **Customize → Connectors → + Add → Add custom connector**. Team and Enterprise: an owner adds it under **Organization settings → Connectors → Add → Custom → Web**.

1. On the VM, create a client with Claude's callback URL:

   ```bash
   yarn mcp:create-client-prod --name Claude --redirect-uri https://claude.ai/api/mcp/auth_callback
   ```

   Replace the `MCP_CLIENTS` line in `.env` with the printed one and restart the app.

2. In Claude: name `xmobile`, URL `https://xmobile.com.tm/api/mcp` exactly (Claude checks it against the metadata), then **Continue**. Under **OAuth client**, choose **Use your own OAuth client** and enter the client ID and secret.
3. Claude opens the xmobile consent page. Sign in as a superuser and press **Allow**.

Claude can't change a connector's OAuth settings after it is added: for a new ID or secret, remove the connector and add it again. Claude calls from `160.79.104.0/21`.

## Connecting Gemini

Google documents custom MCP servers in Gemini through **Gemini Apps Developer Mode** (gemini.google.com/devmode), which may need access requested first.

1. In Gemini: **Settings → Gemini Apps Developer Mode → + Create new**. MCP Server URL `https://xmobile.com.tm/api/mcp`. Open **Additional settings → Show more** (Manual Client Registration) and copy the redirect URI Gemini shows, `https://oauth-redirect.googleusercontent.com/r/<id>`.
2. On the VM, create a client with that URI:

   ```bash
   yarn mcp:create-client-prod --name Gemini --redirect-uri '<redirect URI from step 1>'
   ```

   Replace the `MCP_CLIENTS` line in `.env` with the printed one and restart the app. If Gemini's URI is on `oauth-redirect-sandbox.googleusercontent.com` instead, add that host to `MCP_ALLOWED_REDIRECT_HOSTS` first.

3. Back in Gemini, enter the client ID and secret, then sign in as a superuser on the consent page and press **Allow**.

## Disconnecting

- One connection or all of them: `GET /api/mcp/grants` lists the connections not yet revoked or run out (one whose user is no longer a superuser, or whose client was taken out of `MCP_CLIENTS`, comes with `active: false` and an `inactiveReason`: it doesn't work, but promoting the user again or putting the client back revives it, so revoke it to end it), `DELETE /api/mcp/grants?grantId=<id>` ends one, and `DELETE /api/mcp/grants?all=true` ends all. Superuser token required. This works even with the server switched off.
- One AI app: take its entry out of `MCP_CLIENTS` and restart. Its connections stop working, and it can't connect again.
- Everything at once: set `MCP_ENABLED=false` and restart. Every MCP and OAuth route then answers 404.
