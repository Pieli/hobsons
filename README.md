# Hobson's

> Give LLMs choice with types

A TypeScript library that provides a schema registry system designed for LLM applications. Hobson's allows you to manage Zod schemas with dual repositories - one for original schemas and another optimized for LLM consumption with configurable filtering.

## Features

- **Dual Repository System**: Maintain both original and LLM-optimized versions of your schemas
- **Schema Filtering**: Remove sensitive fields, defaults, and optionals from LLM schemas
- **Type Safety**: Full TypeScript support with Zod integration
- **Discriminated Unions**: Automatically generate discriminated unions from registered schemas
- **Enum Generation**: Create enums from schema types
- **Factory Pattern**: Retrieve schemas by type name
- **Flexible Filtering**: Global and local blacklist support

## Installation

```bash
npm install hobsons
```

## Quick Start

```typescript
import { createRegistry } from 'hobsons';
import { z } from 'zod';

// Create a registry
const registry = createRegistry();

// Define schemas with type literals
const userSchema = z.object({
  type: z.literal('user'),
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(), // This could be filtered for LLMs
  age: z.number().optional(),
});

const postSchema = z.object({
  type: z.literal('post'),
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
});

// Register schemas
registry.register(userSchema);
registry.register(postSchema);

// Access original schemas (unmodified)
const originalUser = registry.original.factory('user');

// Access LLM-optimized schemas (filtered)
const llmUser = registry.llm.factory('user');

// Generate discriminated unions
const dataUnion = registry.original.union;

// Generate enums
const typeEnum = registry.original.enum;
```

## API Reference

### `createRegistry(options?: RegistryOptions): RegistryType`

Creates a new schema registry instance.

#### Options

- `globalBlacklist?: SchemaFilter[]` - Global filters applied to all schemas

### `RegistryType`

#### Properties

- `original: Repo` - Repository containing unmodified schemas
- `llm: Repo` - Repository containing LLM-optimized schemas
- `globalBlacklist: SchemaFilter[]` - Global blacklist filters

#### Methods

- `register(schema, localBlacklist?, opts?)` - Register a schema
- `unregister(name: string)` - Remove a schema by type name

### `Repo`

#### Properties

- `schemas: z.AnyZodObject[]` - Array of registered schemas
- `union: z.ZodDiscriminatedUnion` - Discriminated union of all schemas
- `enum: z.ZodEnum` - Enum of all schema types

#### Methods

- `factory(name: string): z.AnyZodObject | null` - Get schema by type name

## Schema Filtering

Hobson's supports filtering schemas for LLM consumption:

```typescript
import { createRegistry, type SchemaFilter } from 'hobsons';

// Define filters
const removePasswords: SchemaFilter = (key, schema) => key === 'password';
const removeEmails: SchemaFilter = (key, schema) => key === 'email';

// Global filtering (applies to all schemas)
const registry = createRegistry({
  globalBlacklist: [removePasswords, removeEmails]
});

// Local filtering (applies to specific schema)
registry.register(userSchema, [removePasswords]);

// Skip LLM optimization entirely
registry.register(adminSchema, undefined, { ignoreLLM: true });
```

## Schema Requirements

All schemas must include a `type` field with a literal value:

```typescript
// ✅ Valid schema
const validSchema = z.object({
  type: z.literal('user'), // Required
  id: z.string(),
  name: z.string(),
});

// ❌ Invalid schema (missing type literal)
const invalidSchema = z.object({
  id: z.string(),
  name: z.string(),
});
```

## Advanced Usage

### Discriminated Unions

```typescript
registry.register(userSchema);
registry.register(postSchema);

const dataUnion = registry.original.union;

// Parse different types
const user = dataUnion.parse({ type: 'user', id: '1', name: 'John' });
const post = dataUnion.parse({ type: 'post', id: '1', title: 'Hello' });
```

### Type Enums

```typescript
const typeEnum = registry.original.enum;
// typeEnum.options = ['user', 'post']

typeEnum.parse('user'); // ✅ Valid
typeEnum.parse('invalid'); // ❌ Throws error
```

### Schema Management

```typescript
// Check registered schemas
console.log(registry.original.schemas.length);

// Remove a schema
const removed = registry.unregister('user');
console.log(removed); // Returns the removed schema or null
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the library
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

GPL-3.0 license



