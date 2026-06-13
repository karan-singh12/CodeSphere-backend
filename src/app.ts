import express, { Application } from "express";
import routes from "./routes";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import { apiLoggerMiddleware } from "./middleware/apiLogger.middleware";


const app: Application = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()));
}

// CORS — must be first
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.railway.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
