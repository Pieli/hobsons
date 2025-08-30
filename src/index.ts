import { z } from "zod";

export type SchemaFilter = (key: string, schema: z.AnyZodObject) => boolean;

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

  factory(name: string): z.AnyZodObject | null;
}

interface Modifiable {
  add(schema: z.AnyZodObject): void;
}

type ModifiableRepo = Repo & Modifiable;

class SchemaRepo implements ModifiableRepo {
  #schemas: Record<string | number | symbol, z.AnyZodObject> = {};

  #_constructUnion(
    schema: Record<string, z.AnyZodObject>,
  ): z.ZodDiscriminatedUnion<string, [z.AnyZodObject, ...z.AnyZodObject[]]> {
    const schemas = Object.values(schema);
    if (schemas.length < 2) {
      throw new Error("At least 2 schemas are required to construct a union");
    }
    return z.discriminatedUnion(
      "type",
      schemas as [z.AnyZodObject, ...z.AnyZodObject[]],
    );
  }

  public get schemas(): z.AnyZodObject[] {
    return Object.values(this.#schemas);
  }

  public get union(): z.ZodDiscriminatedUnion<
    string,
    [z.AnyZodObject, ...z.AnyZodObject[]]
  > {
    return this.#_constructUnion(this.#schemas);
  }

  public get enum(): z.ZodEnum<[string, ...string[]]> {
    const keys = Object.keys(this.#schemas);
    if (keys.length < 2) {
      throw new Error("At least 2 schemas are required to construct an enum");
    }
    return z.enum(keys as [string, ...string[]]);
  }

  /**
   * Gets the schema object with the type (defined by the literal)
   * is equal to the argument name.
   */
  public factory(name: string): z.AnyZodObject | null {
    return this.#schemas[name] ?? null;
  }

  add(schema: z.AnyZodObject): void {
    const typeField = schema.shape.type as z.ZodLiteral<any>;
    if (!typeField || !typeField._def || typeField._def.value === undefined) {
      throw new Error("Schema must have a type field with a value");
    }
    this.#schemas[typeField._def.value] = schema;
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

  /**
   * Registes a new schema. If an schema with the same type already exists
   * the old value will be overriden with the new one.
   *
   */
  public register(
    schema: z.AnyZodObject,
    localBlacklist?: SchemaFilter[],
    opts?: {
      ignoreLLM?: boolean;
    },
  ): void {
    // check if literal is present
    if (
      !schema.shape.type ||
      !(schema.shape.type._def.typeName === "ZodLiteral") ||
      !schema.shape.type._def.value
    ) {
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
  // remove the type value to protect it

  const typeField = schema.pick({ type: true });
  const withoutTypeField = schema.omit({ type: true });

  const filteredShape = Object.entries(
    withoutTypeField.shape as Record<string, z.AnyZodObject>,
  )
    .filter(([key, zodObj]) => !blacklistedFields.some((f) => f(key, zodObj)))
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

  // reintrodzuce the type field
  return z.object(filteredShape).merge(typeField);
}

// TODO expand to only include supported types
// TODO remove function
// TODO registerMany

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
