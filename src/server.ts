import "dotenv/config";

import app from "./app.js";
import { connectToDatabase } from "./lib/mongodb.js";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`BookNook API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start BookNook API:", error);
    process.exit(1);
  }
}

void startServer();
