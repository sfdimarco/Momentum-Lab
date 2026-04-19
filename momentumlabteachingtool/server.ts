import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/council/brain", async (req, res) => {
    try {
      const data = await fs.readFile(path.join(process.cwd(), "council_brain.json"), "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.json({ uxPatterns: [], userPreferences: {}, questionsAsked: [] });
    }
  });

  app.post("/api/council/brain", async (req, res) => {
    try {
      await fs.writeFile(path.join(process.cwd(), "council_brain.json"), JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save brain" });
    }
  });

  app.post("/api/council/update-md", async (req, res) => {
    const { memberId, content } = req.body;
    try {
      // For now, we update COUNCIL.md or specific member files
      const filePath = memberId ? path.join(process.cwd(), `council_${memberId}.md`) : path.join(process.cwd(), "COUNCIL.md");
      await fs.writeFile(filePath, content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update MD" });
    }
  });

  app.get("/api/substrate", async (req, res) => {
    try {
      const data = await fs.readFile(path.join(process.cwd(), "substrate.json"), "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.json({ neurons: [], geoElements: [], stimulusCount: 0 });
    }
  });

  app.post("/api/substrate", async (req, res) => {
    try {
      await fs.writeFile(path.join(process.cwd(), "substrate.json"), JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save substrate" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
