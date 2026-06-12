import express, { Application } from "express";
import routes from "./routes";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import { apiLoggerMiddleware } from "./middleware/apiLogger.middleware";


const app: Application = express();

// CORS — must be first
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Middleware
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use("/public", express.static("public"));
app.use(morgan("dev"));
app.use(apiLoggerMiddleware);


// API routes
app.use("/api", routes);

export default app;
