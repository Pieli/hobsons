import { z } from "zod";

export type SchemaFilter = (schema: z.AnyZodObject) => boolean;

export interface RegistryOptions {
  readonly globalBlacklist?: SchemaFilter[];
}

export class Registry {
  private _schemas: Record<string, z.AnyZodObject> = {};
  private _llmSchemas: Record<string, z.AnyZodObject> = {};
  private _globalBlacklist: SchemaFilter[];

  constructor(options?: RegistryOptions) {
    this._globalBlacklist = options?.globalBlacklist ?? [];
  }

  public register(
    schema: z.AnyZodObject,
    localBlacklist?: SchemaFilter[],
    opts?: {
      ignoreLLM?: boolean;
    },
  ): void {
    // check if literal is present
    if (!schema.shape.type && !(schema.shape.type._def !== "ZodLiteral")) {
      throw Error(
        "Precodition Failed: Schema is missing the type: zod.literal('...').",
      );
    }

    this._schemas[schema.shape.type] = applyFilter(schema, [
      ...this._globalBlacklist,
      ...(localBlacklist || []),
    ]);

    if (!(opts?.ignoreLLM ?? false)) {
      this._llmSchemas[schema.shape.type] = schema;
    }
  }

  private _constructUnion(
    schema: Record<string, z.AnyZodObject>,
  ): z.ZodDiscriminatedUnion<string, [z.AnyZodObject, ...z.AnyZodObject[]]> {
    const schemas: z.AnyZodObject[] = Object.values(this._schemas);

    if (schemas.length < 2) {
      throw Error("Too few schemas provided... at least 2 needed");
    }
    return z.discriminatedUnion(
      "type",
      schemas as [z.AnyZodObject, z.AnyZodObject, ...z.AnyZodObject[]],
    );
  }

  public get schemas(): z.AnyZodObject[] {
    return Object.values(this._schemas).slice();
  }

  public get llmSchemas(): z.AnyZodObject[] {
    return Object.values(this._llmSchemas).slice();
  }

  public get union(): z.ZodDiscriminatedUnion<
    string,
    [z.AnyZodObject, ...z.AnyZodObject[]]
  > {
    return this._constructUnion(this._schemas);
  }

  public get llmUnion(): z.ZodDiscriminatedUnion<
    string,
    [z.AnyZodObject, ...z.AnyZodObject[]]
  > {
    return this._constructUnion(this._llmSchemas);
  }
}

/**
 * Create filtered schema for LLM by removing blacklisted fields, defaults, and optionals
 */
function applyFilter(
  schema: z.AnyZodObject,
  blacklistedFields: SchemaFilter[],
): z.AnyZodObject {
  const filteredShape = Object.entries(
    schema.shape as Record<string, z.AnyZodObject>,
  )
    .filter(([key, value]) =>
      blacklistedFields.some((f) =>
        typeof f === "string" ? key === f : f(value),
      ),
    )
    .reduce(
      (acc, [key, value]) => {
        let processedValue = value as z.ZodTypeAny;

        // Recursively remove defaults and optionals
        processedValue = removeDefaultsAndOptionals(processedValue);

        acc[key] = processedValue;
        return acc;
      },
      {} as Record<string, z.ZodTypeAny>,
    );

  return z.object(filteredShape);
}

// TODO expand to only include supported types

/**
 * Remove defaults and optionals from a Zod type
 */
function removeDefaultsAndOptionals(zodType: z.ZodTypeAny): z.ZodTypeAny {
  let current = zodType;
  let hasChanges = true;

  // Keep processing until no more changes
  while (hasChanges) {
    hasChanges = false;

    // Remove defaults
    if (current instanceof z.ZodDefault) {
      current = current.removeDefault();
      hasChanges = true;
    }

    // Remove optionals
    if (current instanceof z.ZodOptional) {
      current = current.unwrap();
      hasChanges = true;
    }
  }

  return current;
}
