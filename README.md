# Hobson's

> Give LLMs choice with types


A TypeScript library that provides a schema registry system designed for LLM applications. Hobson's allows you to manage Zod schemas with dual repositories - one for original schemas and another optimized for LLM consumption with configurable filtering.
Hobson's is especially usefull to give LLM's a controlled way to pick objects to create and for the programmer to work with the generated objects in a typed manner.

This tool is made with [Openai's structured outputs](https://platform.openai.com/docs/guides/structured-outputs) in mind, for possible use cases look at [Openai's samples](https://github.com/openai/openai-structured-outputs-samples).


🚧 🚧 🚧 Hobson's is still under development 🚧 🚧 🚧

## Features

- **Dual Repository System**: Maintain both original original zod schems and LLM-optimized versions.
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

// Define visualization schemas with distinct properties
const lineChartSchema = z.object({
  type: z.literal('line_chart'),
  title: z.string(),
  xAxis: z.object({
    label: z.string(),
    data: z.array(z.union([z.string(), z.number()])),
  }),
  yAxis: z.object({
    label: z.string(),
    data: z.array(z.number()),
  }),
  lineColor: z.string().optional(),
  showGrid: z.boolean().optional(),
});

const pieChartSchema = z.object({
  type: z.literal('pie_chart'),
  title: z.string(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
  showLegend: z.boolean().optional(),
  showPercentages: z.boolean().optional(),
});

// Register visualization schemas
registry.register(lineChartSchema);
registry.register(pieChartSchema);

// Access original schemas (unmodified)
const originalLineChart = registry.original.factory('line_chart');

// Access LLM-optimized schemas (filtered)
const llmLineChart = registry.llm.factory('line_chart');

// Generate discriminated unions for chart types
const chartUnion = registry.original.union;

// Generate enums for chart types
const chartTypeEnum = registry.original.enum;
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

## LLM Object Creation

Use the union type to enable LLMs to create structured objects by simply passing the union schema:

```typescript
import { createRegistry } from 'hobsons';
import { z } from 'zod';

// Set up visualization schemas
const registry = createRegistry({
  globalBlacklist: [
    (key) => key === 'internalId', // Remove internal fields
    (key) => key.startsWith('_'), // Remove private fields
  ]
});

// Register visualization schemas
registry.register(z.object({
  type: z.literal('line_chart'),
  title: z.string(),
  xAxis: z.object({
    label: z.string(),
    data: z.array(z.union([z.string(), z.number()])),
  }),
  yAxis: z.object({
    label: z.string(),
    data: z.array(z.number()),
  }),
  lineColor: z.string().optional(), // Will be required for LLMs
  showGrid: z.boolean().optional(),
}));

registry.register(z.object({
  type: z.literal('pie_chart'),
  title: z.string(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
  showLegend: z.boolean().optional(), // Will be required for LLMs
  showPercentages: z.boolean().optional(),
}));

// Get the LLM-optimized union for visualization selection
const llmUnion = registry.llm.union;

// Now LLMs can choose between different chart types based on data and requirements
// The LLM will see clean schemas without optional fields

// Example: LLM chooses line chart for time series data
const llmGeneratedLineChart = llmUnion.parse({
  type: 'line_chart',
  title: 'Sales Over Time',
  xAxis: {
    label: 'Month',
    data: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  },
  yAxis: {
    label: 'Revenue ($)',
    data: [10000, 12000, 15000, 13000, 18000],
  },
  lineColor: '#2563eb',
  showGrid: true,
});

// Example: LLM chooses pie chart for categorical data
const llmGeneratedPieChart = llmUnion.parse({
  type: 'pie_chart',
  title: 'Market Share by Product',
  data: [
    { label: 'Product A', value: 45, color: '#3b82f6' },
    { label: 'Product B', value: 30, color: '#ef4444' },
    { label: 'Product C', value: 25, color: '#22c55e' },
  ],
  showLegend: true,
  showPercentages: true,
});

// Type inference works perfectly
type ChartData = z.infer<typeof llmUnion>;
// ChartData = { type: 'line_chart', ... } | { type: 'pie_chart', ... }
```

## Schema Requirements

In Hobson's, all schemas must include a `type` field with a literal value:

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
registry.register(lineChartSchema);
registry.register(pieChartSchema);

const chartUnion = registry.original.union;

// Parse different chart types
const lineChart = chartUnion.parse({
  type: 'line_chart',
  title: 'Sales Trend',
  xAxis: { label: 'Month', data: ['Jan', 'Feb'] },
  yAxis: { label: 'Sales', data: [100, 150] }
});
const pieChart = chartUnion.parse({
  type: 'pie_chart',
  title: 'Category Split',
  data: [{ label: 'A', value: 60 }, { label: 'B', value: 40 }]
});
```

### Type Enums

```typescript
const chartTypeEnum = registry.original.enum;
// chartTypeEnum.options = ['line_chart', 'pie_chart']

chartTypeEnum.parse('line_chart'); // ✅ Valid
chartTypeEnum.parse('invalid'); // ❌ Throws error
```

### Schema Management

```typescript
// Check registered schemas
console.log(registry.original.schemas.length);

// Remove a schema
const removed = registry.unregister('line_chart');
console.log(removed); // Returns the removed schema or null
```

### LLM Integration Example

```typescript
// Set up your registry with LLM-optimized schemas
const registry = createRegistry({
  globalBlacklist: [
    (key) => key.includes('password'),
    (key) => key.includes('secret'),
    (key) => key.startsWith('_'), // Remove private fields
  ]
});

// Register visualization schemas
registry.register(lineChartSchema);
registry.register(pieChartSchema);

// Get the union for LLM consumption
const llmUnion = registry.llm.union;

// Use with your LLM API (example with OpenAI)
async function generateVisualization(prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You must choose the appropriate chart type. Choose 'line_chart' for time series or trend data, 'pie_chart' for categorical proportions.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    text: {
    format: zodTextFormat(CalendarEvent, "event"),
    },
  });

  // return parsed result
  return response.output_parsed;
}

// The LLM chooses the appropriate chart type based on the request
const result = await generateVisualization("Visualize monthly sales data from January to December");
// result: { type: 'line_chart', title: 'Monthly Sales', xAxis: { label: 'Month', data: [...] }, yAxis: { label: 'Sales ($)', data: [...] } }

const pieResult = await generateVisualization("Show market share breakdown by product category");
// pieResult: { type: 'pie_chart', title: 'Market Share by Category', data: [{ label: 'Electronics', value: 40 }, ...] }
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
