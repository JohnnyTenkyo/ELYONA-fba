import { Router } from "express";

export function registerHealthRoutes(app: any) {
  const router = Router();
  
  router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  app.use("/api", router);
}
