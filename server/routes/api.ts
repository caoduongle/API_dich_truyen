import { Router } from "express";
import {
  analyzeGlossary,
  analyzeGuidelines,
  extractGlossary
} from "../controllers/glossaryController.ts";
import {
  translateRaw,
  polishTranslation
} from "../controllers/translationController.ts";
import {
  alignChapter
} from "../controllers/alignmentController.ts";

const router = Router();

// Routes for Glossary & Guidelines Analysis
router.post("/analyze-glossary", analyzeGlossary);
router.post("/analyze-guidelines", analyzeGuidelines);
router.post("/extract-glossary", extractGlossary);

// Routes for Translation Tasks
router.post("/translate-raw", translateRaw);
router.post("/polish-translation", polishTranslation);

// Routes for Bilingual alignment
router.post("/align-chapter", alignChapter);

// Health check endpoint
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
