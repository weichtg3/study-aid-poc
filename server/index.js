import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const publicDirectory = path.join(root, "public");

app.disable("x-powered-by");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "microphone=(self)");
  next();
});

// This server is only a local/static host. GitHub Pages serves the same paths.
app.use("/courses", express.static(path.join(root, "data", "courses")));
app.use(express.static(publicDirectory, { extensions: ["html"] }));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(publicDirectory, "index.html")));

app.listen(port, "0.0.0.0", () => {
  console.log(`Study Bloom ready at http://localhost:${port}`);
});
