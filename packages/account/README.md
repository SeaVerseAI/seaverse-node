# @seaverse/account

> SeaVerse Account Hub APIs for authentication and user management

Part of the [seaverse-node](https://github.com/SeaVerseAI/seaverse-node) SDK family.

## Installation

```bash
npm install @seaverse/account
```

## Quick Start

```typescript
import { createClient } from '@seaverse/account';

// Create client with default endpoint
const client = createClient();

// Use the client to call API endpoints
// See API documentation for available methods
```

### Custom Configuration

```typescript
import { createClient } from '@seaverse/account';

// Override default endpoint
const client = createClient({
  baseUrl: 'https://custom.api.com',
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## Default Endpoint

The default endpoint is: **`https://account.seaverse.ai`**

## Features

- ✅ **Type-safe** - Full TypeScript support with auto-generated types
- ✅ **Modern** - Uses native Fetch API
- ✅ **Tree-shakable** - Import only what you need
- ✅ **Lightweight** - Minimal dependencies
- ✅ **ESM** - Modern ES modules

## API Documentation

For full API documentation, see:
- [SeaVerse Account Hub API Docs](https://account.seaverse.ai/docs)
- [GitHub Repository](https://github.com/SeaVerseAI/seaverse-node)

## Versioning

This package follows [Semantic Versioning](https://semver.org/) and is independently versioned from other seaverse-node packages.

## Auto-Generated

⚠️ This SDK is auto-generated from OpenAPI specifications. **Do not edit manually.**

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Apache-2.0

---

Generated from [account-hub](https://github.com/SeaVerseAI/account-hub) OpenAPI specification • Copyright © 2026 SeaVerse AI
