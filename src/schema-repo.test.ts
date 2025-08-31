import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

// We need to access the private SchemaRepo class for testing
// Since it's not exported, we'll test it through the Registry's repos
import { createRegistry, type RegistryType } from "./index.js";

describe("SchemaRepo (tested through Registry)", () => {
  let registry: RegistryType;

  beforeEach(() => {
    registry = createRegistry();
  });

  describe("schemas getter", () => {
    it("should return empty array when no schemas registered", () => {
      expect(registry.original.schemas).toEqual([]);
      expect(registry.llm.schemas).toEqual([]);
    });

    it("should return array of registered schemas", () => {
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

      const schemas = registry.original.schemas;
      expect(schemas).toHaveLength(2);
      expect(schemas).toContain(userSchema);
      expect(schemas).toContain(postSchema);
    });

    it("should return a copy of schemas array (immutable)", () => {
      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
      });

      registry.register(userSchema);

      const schemas1 = registry.original.schemas;
      const schemas2 = registry.original.schemas;

      // same, same, but different
      expect(schemas1).toEqual(schemas2);
      expect(schemas1).not.toBe(schemas2);

      // Modifying returned array shouldn't affect internal state
      schemas1.pop();
      expect(registry.original.schemas).toHaveLength(1);
    });
  });

  describe("union getter", () => {
    it("should throw error with fewer than 2 schemas", () => {
      expect(() => registry.original.union).toThrow(
        "At least 2 schemas are required to construct a union",
      );

      const singleSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
      });
      registry.register(singleSchema);

      expect(() => registry.original.union).toThrow(
        "At least 2 schemas are required to construct a union",
      );
    });

    it("should create discriminated union with 2 schemas", () => {
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

      const union = registry.original.union;

      // Test successful parsing
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
          title: "Test",
        }),
      ).not.toThrow();

      // Test failed parsing
      expect(() =>
        union.parse({
          type: "invalid",
          id: "1",
        }),
      ).toThrow();
    });

    it("should create discriminated union with multiple schemas", () => {
      const schemas = [
        z.object({
          type: z.literal("user"),
          id: z.string(),
          name: z.string(),
        }),
        z.object({
          type: z.literal("post"),
          id: z.string(),
          title: z.string(),
        }),
        z.object({
          type: z.literal("comment"),
          id: z.string(),
          content: z.string(),
        }),
      ];

      schemas.forEach((schema) => registry.register(schema));

      const union = registry.original.union;

      expect(() =>
        union.parse({
          type: "user",
          id: "1",
          name: "John",
        }),
      ).not.toThrow();

      expect(() =>
        union.parse({
          type: "comment",
          id: "1",
          content: "Hello",
        }),
      ).not.toThrow();
    });
  });

  describe("enum getter", () => {
    it("should throw error with fewer than 2 schemas", () => {
      expect(() => registry.original.enum).toThrow(
        "At least 2 schemas are required to construct an enum",
      );
    });

    it("should create enum from schema types", () => {
      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
      });

      const postSchema = z.object({
        type: z.literal("post"),
        id: z.string(),
      });

      registry.register(userSchema);
      registry.register(postSchema);

      const enumSchema = registry.original.enum;

      expect(enumSchema.options).toEqual(["user", "post"]);
      expect(() => enumSchema.parse("user")).not.toThrow();
      expect(() => enumSchema.parse("post")).not.toThrow();
      expect(() => enumSchema.parse("invalid")).toThrow();
    });

    it("should handle multiple schema types in enum", () => {
      const schemas = [
        z.object({ type: z.literal("a"), id: z.string() }),
        z.object({ type: z.literal("b"), id: z.string() }),
        z.object({ type: z.literal("c"), id: z.string() }),
      ];

      schemas.forEach((schema) => registry.register(schema));

      const enumSchema = registry.original.enum;
      expect(enumSchema.options).toEqual(["a", "b", "c"]);
    });
  });

  describe("factory method", () => {
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

    it("should return schema for existing type", () => {
      const userSchema = registry.original.factory("user");
      const postSchema = registry.original.factory("post");

      expect(userSchema).toBeDefined();
      expect(postSchema).toBeDefined();

      // Test that returned schemas can parse correctly
      expect(() =>
        userSchema!.parse({
          type: "user",
          id: "1",
          name: "John",
        }),
      ).not.toThrow();

      expect(() =>
        postSchema!.parse({
          type: "post",
          id: "1",
          title: "Test",
        }),
      ).not.toThrow();
    });

    it("should return undefined for non-existent type", () => {
      const nonexistentSchema = registry.original.factory("nonexistent");
      expect(nonexistentSchema).toBeNull();
    });

    it("should return different schemas for different repos", () => {
      const originalUserSchema = registry.original.factory("user");
      const llmUserSchema = registry.llm.factory("user");

      expect(originalUserSchema).toBeDefined();
      expect(llmUserSchema).toBeDefined();

      // They should be different objects due to filtering
      expect(originalUserSchema).not.toBe(llmUserSchema);
    });
  });
});
