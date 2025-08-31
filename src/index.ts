import { z } from "zod";
import {
  Registry,
  type Repo,
  type RegistryOptions,
  type SchemaFilter,
} from "./internals.js";

export type { Repo, SchemaFilter } from "./internals.js";

export interface RegistryType {
  get llm(): Repo;
  get original(): Repo;
  get globalBlacklist(): SchemaFilter[];
  register(
    schema: z.AnyZodObject,
    localBlacklist?: SchemaFilter[],
    opts?: { ignoreLLM?: boolean },
  ): void;
  unregister(name: string): z.AnyZodObject | null;
}

export function createRegistry(options?: RegistryOptions): RegistryType {
  return new Registry(options);
}
