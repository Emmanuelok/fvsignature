import { defineConfig } from "drizzle-kit";
export default defineConfig({out:"./migrations/generated",schema:"./db/schema.ts",dialect:"postgresql"});
