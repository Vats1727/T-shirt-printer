import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// No-op DB for this project as we use JSON storage
export const db = {} as any; 
export const pool = {} as any;
