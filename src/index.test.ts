import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { Registry, type SchemaFilter } from "./index.js";

describe("Registry", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe("constructor", () => {
    it("should create registry without options", () => {
      const reg = new Registry();
      expect(reg).toBeDefined();
      expect(reg.llm).toBeDefined();
      expect(reg.original).toBeDefined();
    });

    it("should create registry with global blacklist", () => {
      const blacklistFilter: SchemaFilter = (schema) =>
        schema.shape.id !== undefined;
      const reg = new Registry({ globalBlacklist: [blacklistFilter] });
      expect(reg).toBeDefined();
    });
  });

  describe("register", () => {
    const userSchema = z.object({
      type: z.literal("user"),
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      age: z.number().optional(),
      settings: z
        .object({
          theme: z.string().default("light"),
          notifications: z.boolean().default(true),
        })
        .optional(),
    });

    const postSchema = z.object({
      type: z.literal("post"),
      id: z.string(),
      title: z.string(),
      content: z.string(),
      authorId: z.string(),
    });

    it("should register schema successfully", () => {
      expect(() => registry.register(userSchema)).not.toThrow();

      expect(registry.original.schemas).toHaveLength(1);
      expect(registry.llm.schemas).toHaveLength(1);

      expect(() => registry.register(postSchema)).not.toThrow();
      expect(registry.original.schemas).toHaveLength(2);
      expect(registry.llm.schemas).toHaveLength(2);
    });

    it("should throw error when schema missing type literal", () => {
      const invalidSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      expect(() => registry.register(invalidSchema)).toThrow(
        "Precodition Failed: Schema is missing the type: zod.literal('...').",
      );
    });

    it("should register schema to both original and llm repos by default", () => {
      registry.register(userSchema);

      expect(registry.original.factory("user")).toBeDefined();
      expect(registry.llm.factory("user")).toBeDefined();
    });

    it("should skip llm registration when ignoreLLM is true", () => {
      registry.register(userSchema, undefined, { ignoreLLM: true });

      expect(registry.original.factory("user")).toBeDefined();
      expect(registry.llm.factory("user")).toBeUndefined();
    });

    it.only("should apply global blacklist filters (remove all)", () => {
      const blacklistFilter: SchemaFilter = () => true; // Remove all fields
      const regWithBlacklist = new Registry({
        globalBlacklist: [blacklistFilter],
      });

      regWithBlacklist.register(userSchema);

      const llmSchema = regWithBlacklist.llm.factory("user");
      expect(llmSchema).toBeDefined();
    });

    it.only("should apply global blacklist filters (remove some)", () => {
      const blacklistFilter: SchemaFilter = () => true; // Remove all fields
      const regWithBlacklist = new Registry({
        globalBlacklist: [blacklistFilter],
      });

      regWithBlacklist.register(userSchema);

      const llmSchema = regWithBlacklist.llm.factory("user");
      expect(llmSchema).toBeDefined();
    });

    it("should apply local blacklist filters", () => {
      const localFilter: SchemaFilter = () => true;

      registry.register(userSchema, [localFilter]);

      const llmSchema = registry.llm.factory("user");
      expect(llmSchema).toBeDefined();
    });

    it("should handle multiple schema registrations", () => {
      registry.register(userSchema);
      registry.register(postSchema);

      expect(registry.original.schemas).toHaveLength(2);
      expect(registry.llm.schemas).toHaveLength(2);
    });
  });

  describe("repository access", () => {
    beforeEach(() => {
      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
      });

      const postSchema = z.object({
        type: z.literal("post"),
        id: z.string(),
        title: z.string(),
      });

      registry.register(userSchema);
      registry.register(postSchema);
    });

    it("should provide access to original repository", () => {
      const originalRepo = registry.original;
      expect(originalRepo.schemas).toHaveLength(2);
    });

    it("should provide access to llm repository", () => {
      const llmRepo = registry.llm;
      expect(llmRepo.schemas).toHaveLength(2);
    });
  });

  describe("SchemaRepo functionality through Registry", () => {
    beforeEach(() => {
      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
      });

      const postSchema = z.object({
        type: z.literal("post"),
        id: z.string(),
        title: z.string(),
      });

      registry.register(userSchema);
      registry.register(postSchema);
    });

    it("should create discriminated union", () => {
      const union = registry.original.union;
      expect(union).toBeDefined();

      // Test that union can parse valid objects
      expect(() =>
        union.parse({
          type: "user",
          id: "1",
          name: "John",
        }),
      ).not.toThrow();

      expect(() =>
        union.parse({
          type: "post",
          id: "1",
          title: "Test Post",
        }),
      ).not.toThrow();

      // Test that union rejects invalid discriminator
      expect(() =>
        union.parse({
          type: "invalid",
          id: "1",
        }),
      ).toThrow();
    });

    it("should create enum from schema types", () => {
      const enumSchema = registry.original.enum;
      expect(enumSchema).toBeDefined();

      expect(enumSchema.options).toEqual(["user", "post"]);
    });

    it("should provide factory method", () => {
      const userSchema = registry.original.factory("user");
      const postSchema = registry.original.factory("post");
      const nonexistentSchema = registry.original.factory("nonexistent");

      expect(userSchema).toBeDefined();
      expect(postSchema).toBeDefined();
      expect(nonexistentSchema).toBeUndefined();
    });

    it("should return copy of schemas array", () => {
      const schemas1 = registry.original.schemas;
      const schemas2 = registry.original.schemas;

      expect(schemas1).toEqual(schemas2);
      expect(schemas1).not.toBe(schemas2); // Different references
    });
  });

  describe("error handling", () => {
    it("should throw error when trying to create union with fewer than 2 schemas", () => {
      const singleSchema = z.object({
        type: z.literal("single"),
        id: z.string(),
      });

      registry.register(singleSchema);

      // Clear one schema to test the error
      const emptyRegistry = new Registry();
      expect(() => emptyRegistry.original.union).toThrow(
        "Too few schemas provided... at least 2 needed",
      );
    });

    it("should throw error when trying to create enum with fewer than 2 schemas", () => {
      const emptyRegistry = new Registry();
      expect(() => emptyRegistry.original.enum).toThrow(
        "An enum needs at least two schemas to be constructued",
      );
    });
  });
});
