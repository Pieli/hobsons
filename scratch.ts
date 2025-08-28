import { z } from "zod";
import { Registry } from "./src/index.js";

// Example schemas to test with
const UserSchema = z.object({
  type: z.literal("user"),
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const ProductSchema = z.object({
  type: z.literal("product"),
  id: z.string(),
  name: z.string(),
  price: z.number(),
});

const OrderSchema = z.object({
  type: z.literal("order"),
  id: z.string(),
  userId: z.string(),
  items: z.array(z.string()),
  total: z.number(),
});

// Create registry with filters
const registry = new Registry();

// Register schemas
console.log(Object.keys(UserSchema.shape));
registry.register(UserSchema);
registry.register(ProductSchema);
registry.register(OrderSchema);

// Test the registry
console.log("Regular schemas:", registry.original.schemas.length);
console.log("LLM schemas:", registry.llm.schemas.length);
