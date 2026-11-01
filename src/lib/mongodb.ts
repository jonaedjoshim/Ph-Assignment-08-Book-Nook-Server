import { setServers } from "node:dns";
import { MongoClient, type Db } from "mongodb";

import {
  BOOKS_COLLECTION,
  BORROWS_COLLECTION,
  initializeDatabase,
} from "../db/initialize.js";
import type { BookDocument, BorrowDocument } from "../types/book.js";

let database: Db | null = null;
let mongoClient: MongoClient | null = null;

function configureDnsServers() {
  const servers = process.env.DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers?.length) {
    setServers(servers);
  }
}

export async function connectToDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  configureDnsServers();

  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.DB_NAME?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  if (!databaseName) {
    throw new Error("DB_NAME is missing from the environment.");
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    await client.connect();

    const connectedDatabase = client.db(databaseName);

    await connectedDatabase.command({ ping: 1 });
    await initializeDatabase(connectedDatabase);

    database = connectedDatabase;
    mongoClient = client;

    console.log(`Connected to MongoDB database "${databaseName}".`);

    return connectedDatabase;
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

export function getDatabase(): Db {
  if (!database) {
    throw new Error("MongoDB has not been connected yet.");
  }

  return database;
}

export function getMongoClient(): MongoClient {
  if (!mongoClient) {
    throw new Error("MongoDB client has not been initialized.");
  }

  return mongoClient;
}

export function getBooksCollection() {
  return getDatabase().collection<BookDocument>(BOOKS_COLLECTION);
}

export function getBorrowsCollection() {
  return getDatabase().collection<BorrowDocument>(BORROWS_COLLECTION);
}
