import express from "express";
import cors from "cors";
import helmet from "helmet";

import booksRouter from "./routes/books.routes.js";
import borrowsRouter from "./routes/borrows.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

export default app;
