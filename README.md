# Polymarket MCP Server

An MCP (Model Context Protocol) server for interacting with Polymarket prediction markets.

## Features

- **list_markets** - List and filter prediction markets from Polymarket

## Installation

```bash
npm install
npm run build
```

## Usage

### Running the server

```bash
npm start
```

### Development mode

```bash
npm run dev
```

### Adding to Cursor

Add the following to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["/path/to/poly-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### list_markets

List prediction markets from Polymarket.

**Parameters:**
- `limit` (number, optional): Number of markets to return (1-100, default: 10)
- `active` (boolean, optional): Filter by active status
- `closed` (boolean, optional): Filter by closed status
- `cursor` (string, optional): Pagination cursor for fetching next page

**Example:**
```
List 5 active markets on Polymarket
```

## License

MIT

