import { setServers } from "node:dns";
import { MongoClient, type Db } from "mongodb";

let database: Db | null = null;

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

    database = connectedDatabase;

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
