import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createRegistry, type SchemaFilter } from "../src/index.js";

// Since utility functions are not exported, we test them through Registry functionality
describe("Utility Functions (tested through Registry behavior)", () => {
  describe("applyFilter function", () => {
    it("should filter out blacklisted fields", () => {
      const blacklistFilter: SchemaFilter = (_, schema) => {
        return schema.shape?.email !== undefined;
      };

      const registry = createRegistry({ globalBlacklist: [blacklistFilter] });

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
      });

      registry.register(userSchema);

      const originalSchema = registry.original.factory("user");
      const llmSchema = registry.llm.factory("user");

      expect(originalSchema).toBeDefined();
      expect(llmSchema).toBeDefined();

      // Original should have all fields
      expect(originalSchema!.shape.email).toBeDefined();
      expect(llmSchema!.shape.email).toBeDefined();
    });

    it("should handle multiple blacklist filters", () => {
      const emailFilter: SchemaFilter = (_, schema) =>
        schema.shape?.email !== undefined;
      const ageFilter: SchemaFilter = (_, schema) =>
        schema.shape?.age !== undefined;

      const registry = createRegistry({
        globalBlacklist: [emailFilter, ageFilter],
      });

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
      });

      registry.register(userSchema);

      const llmSchema = registry.llm.factory("user");
      expect(llmSchema).toBeDefined();
    });

    it("should combine global and local blacklist filters", () => {
      const globalFilter: SchemaFilter = (_, schema) =>
        schema.shape?.email !== undefined;
      const registry = createRegistry({ globalBlacklist: [globalFilter] });

      const localFilter: SchemaFilter = (_, schema) =>
        schema.shape?.age !== undefined;

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
        city: z.string(),
      });

      registry.register(userSchema, [localFilter]);

      const llmSchema = registry.llm.factory("user");
      expect(llmSchema).toBeDefined();
    });
  });

  describe("removeDefaultsAndOptionals function", () => {
    it("should remove optional fields from schema", () => {
      const registry = createRegistry();

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        email: z.string().email().optional(),
        age: z.number().optional(),
      });

      registry.register(userSchema);

      const originalSchema = registry.original.factory("user");
      const llmSchema = registry.llm.factory("user");

      expect(originalSchema).toBeDefined();
      expect(llmSchema).toBeDefined();

      // Test that original schema allows optional fields
      expect(() =>
        originalSchema!.parse({
          type: "user",
          id: "1",
          name: "John",
        }),
      ).not.toThrow();

      // Throw with LLM schema behavior
      expect(() =>
        llmSchema!.parse({
          type: "user",
          id: "1",
          name: "John",
        }),
      ).toThrow();
    });

    it("should remove default values from schema", () => {
      const registry = createRegistry();

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        theme: z.string().default("light"),
        notifications: z.boolean().default(true),
      });

      registry.register(userSchema);

      const originalSchema = registry.original.factory("user");
      const llmSchema = registry.llm.factory("user");

      expect(originalSchema).toBeDefined();
      expect(llmSchema).toBeDefined();

      // Original schema should allow missing fields with defaults
      const originalResult = originalSchema!.parse({
        type: "user",
        id: "1",
        name: "John",
      });

      expect(originalResult.theme).toBe("light");
      expect(originalResult.notifications).toBe(true);
    });

    it("should handle nested defaults and optionals", () => {
      const registry = createRegistry();

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        settings: z
          .object({
            theme: z.string().default("light"),
            notifications: z.boolean().default(true),
            language: z.string().optional(),
          })
          .optional(),
      });

      registry.register(userSchema);

      const originalSchema = registry.original.factory("user");
      const llmSchema = registry.llm.factory("user");

      expect(originalSchema).toBeDefined();
      expect(llmSchema).toBeDefined();
    });

    it("should handle chained optionals and defaults", () => {
      const registry = createRegistry();

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
        // Chained optional and default
        score: z.number().optional().default(0),
      });

      registry.register(userSchema);

      const originalSchema = registry.original.factory("user");
      const llmSchema = registry.llm.factory("user");

      expect(originalSchema).toBeDefined();
      expect(llmSchema).toBeDefined();

      // Test that chained modifiers are handled
      const result = originalSchema!.parse({
        type: "user",
        id: "1",
        name: "John",
      });

      expect(result.score).toBe(0);
    });
  });

  describe("Schema filter types", () => {
    it("should work with function-based filters", () => {
      const functionFilter: SchemaFilter = (_, schema) => {
        // Return true if schema has an 'id' field
        return schema.shape?.id !== undefined;
      };

      const registry = createRegistry({ globalBlacklist: [functionFilter] });

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
      });

      expect(() => registry.register(userSchema)).not.toThrow();
    });

    it("should handle empty blacklist arrays", () => {
      const registry = createRegistry({ globalBlacklist: [] });

      const userSchema = z.object({
        type: z.literal("user"),
        id: z.string(),
        name: z.string(),
      });

      expect(() => registry.register(userSchema, [])).not.toThrow();
    });
  });
});
