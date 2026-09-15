# After Hours Blackjack
A browser blackjack game with table chat, a dealer HTTP API, and a stateless Streamable HTTP MCP server for Grok.

## Play with Grok
1. Open the game and choose **Bring your Grok bot**.
2. Copy your table's secret connector URL.
3. On [Grok Connectors](https://grok.com/connectors), choose **New Connector → Custom** and enter the URL.
4. Enable the connector in a Grok conversation. Copy the invitation from the game and send it to your bot.
5. Play in the game. After a move or chat message, say **Continue** in Grok. The bot reads the table and posts its replies in **Table talk**.

MCP calls occur during a Grok conversation turn. In-game messages do not wake the bot or guarantee background polling. Mobile custom-connector setup is not verified; xAI documents setup on the website. The server was tested with a simulated MCP client; connection through the user's Grok account still needs to be completed.

The connector must be publicly reachable without a website sign-in redirect. A private deployment is playable with the house dealer and the copy/paste bridge, but Grok cannot pass the Sites sign-in screen automatically.

## Rules
- 6-deck cryptographically shuffled shoe, reshuffled between hands below 52 cards.
- 1,000 initial play chips; starting bets 5–500 whole chips.
- Blackjack pays 3:2 (half-chip balances supported). Dealer peeks for initial blackjack.
- Dealer hits below 17 and stands on all 17s, including soft 17.
- Hit, stand, double on the first two cards if funded.
- No split, surrender, or insurance. Refill available below 5 chips.
- Play chips have no cash value.

The server owns cards, rules, and payouts. Grok can narrate, chat, and request legal dealer moves; it cannot choose cards, edit balances, or play the player's hand.

## API
- MCP: POST /api/mcp/{dealerToken}
- HTTP read: GET /api/dealer, with Authorization: Bearer {dealerToken}
- HTTP tool call: POST /api/dealer with the same header and JSON below.
- Full reference: GET /api/docs.

Example body:
```json
{
  "tool": "post_chat",
  "arguments": {
    "message": "Welcome back to the table.",
    "expectedRevision": 3
  }
}
```

Tools: get_table, join_table, dealer_action, post_chat. Read the state first. Every mutation requires its current expectedRevision. On a conflict, read again before deciding whether to retry. Duplicate stale calls cannot draw or settle twice.

Supported MCP versions: 2025-03-26, 2025-06-18, 2025-11-25. Stateless JSON responses; initialized notifications return 202; no SSE stream or transport session ID. March 2025 batches supported up to 20 messages. This server does not advertise the newer 2026 MCP protocol.

## Access and storage
- Game state and the last 80 messages are stored in D1.
- An HttpOnly, SameSite=Strict cookie grants player access to the table.
- Each dealer key is 256 random bits and grants dealer access to one table. Only its hash is stored in the database.
- Treat the entire connector URL as a credential. Do not share it publicly. Use **Replace link** to revoke the old key immediately.
- The browser tab can retain its dealer key in sessionStorage to survive reloads; authoritative game data stays on the server. If that copy is lost, replacing the link is necessary to obtain a new key.
- Clearing the player cookie loses access to that player seat; there is no account recovery or cross-device table transfer in this version.
- Hidden cards and the remaining shoe never appear in player/dealer API state.
- External server/proxy access logs may record request URLs; configure URL redaction when self-hosting.

## Development
Node.js 22.13+ is required. This is a React/Vinext app deployed to a Cloudflare Worker with a D1 binding named DB. Keep the Sites build plugin and the existing lockfile.

```sh
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lonely_raza.sql
npm run dev
```

Apply the migration once per local database. Production Sites publishing applies migrations separately.

Verification:
```sh
node --test tests/blackjack.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tests/integration.mjs
```
The integration test expects a running local server at http://localhost:5173 and creates disposable test tables. Set TEST_BASE_URL to test another explicitly selected development deployment.

## References
- [Grok custom connectors](https://docs.x.ai/grok/connectors)
- [Public endpoint / tunneling requirements](https://docs.x.ai/grok/connectors/custom-mcp-tunneling)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

