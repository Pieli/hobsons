import { z } from "zod";

export type SchemaFilter = (schema: z.AnyZodObject) => boolean;

export interface RegistryOptions {
  readonly globalBlacklist?: SchemaFilter[];
}

export interface Repo {
  get schemas(): z.AnyZodObject[];
  get enum(): z.ZodEnum<[string, ...string[]]>;
  get union(): z.ZodDiscriminatedUnion<
    string,
    [z.AnyZodObject, ...z.AnyZodObject[]]
  >;

  factory(name: string): z.AnyZodObject | undefined;
}

interface Modifiable {
  add(schema: z.AnyZodObject): void;
}

type ModifiableRepo = Repo & Modifiable;

class SchemaRepo implements ModifiableRepo {
  private _schemas: Record<string, z.AnyZodObject> = {};

  constructor() {}

  private _constructUnion(
    schema: Record<string, z.AnyZodObject>,
  ): z.ZodDiscriminatedUnion<string, [z.AnyZodObject, ...z.AnyZodObject[]]> {
    const schemas: z.AnyZodObject[] = Object.values(schema);

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

  public get union(): z.ZodDiscriminatedUnion<
    string,
    [z.AnyZodObject, ...z.AnyZodObject[]]
  > {
    return this._constructUnion(this._schemas);
  }

  public get enum(): z.ZodEnum<[string, ...string[]]> {
    if (Object.keys.length < 2) {
      throw Error("An enum needs at least two schemas to be constructued");
    }
    return z.enum(Object.keys(this._schemas) as [string, ...string[]]);
  }

  public factory(name: string): z.AnyZodObject | undefined {
    return this._schemas[name];
  }

  add(schema: z.AnyZodObject): void {
    this._schemas[schema.shape.type] = schema;
  }
}

export class Registry {
  private _llm: ModifiableRepo;
  private _original: ModifiableRepo;

  private _globalBlacklist: SchemaFilter[];

  constructor(options?: RegistryOptions) {
    this._globalBlacklist = options?.globalBlacklist ?? [];
    this._llm = new SchemaRepo();
    this._original = new SchemaRepo();
  }

  public get llm(): Repo {
    return this._llm;
  }

  public get original(): Repo {
    return this._original;
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

    this._original.add(schema);

    if (!(opts?.ignoreLLM ?? false)) {
      this._llm.add(
        applyFilter(schema, [
          ...this._globalBlacklist,
          ...(localBlacklist || []),
        ]),
      );
    }
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
// TODO remove function
// TODO registerMany

// TODO object matching ( there exists already an object)

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
