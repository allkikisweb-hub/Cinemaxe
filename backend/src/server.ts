import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GoogleGenAI } from "@google/genai";
import { authRouter } from "./routes/website";
import { adminRouter } from "./routes/admin";
import { seedAdminUser, getUserById, getOptionalUserId, AuthedRequest, isAdminEmail } from "./lib/auth";
import db from "./lib/db";
import { buildCinemaxKnowledgeBase } from "./lib/assistantKnowledge";
import { matchMoviesFromAnalysis, VisualAnalysis } from "./lib/tmdbMatch";

function getApiKey(name: "tmdb" | "gemini" | "groq"): string {
  const fromDb = db.data.site_settings?.apiKeys?.[name];
  const fromEnv = name === "tmdb"
    ? process.env.TMDB_API_KEY
    : name === "gemini"
    ? process.env.GEMINI_API_KEY
    : process.env.GROQ_API_KEY;
  return (fromDb || fromEnv || "").trim();
}

// (dotenv is loaded via the side-effect import above, before any other
// module — including server/mailer.ts — reads from process.env.)

function getGeminiClient(): GoogleGenAI {
  const key = getApiKey("gemini");
  if (!key) throw new Error("Gemini API key not configured");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

async function analyzeImageWithGemini(imageBase64: string, mimeType: string, userQuestion?: string): Promise<VisualAnalysis & { description: string }> {
  const questionBlock = userQuestion
    ? `\nThe user also asks: "${userQuestion}" — factor this into your genre/keyword choices.`
    : "";

  const prompt = `You are a film curator analyzing an image (poster, screenshot, or photo) to find visually or thematically similar movies.
Look at composition, color palette, lighting, mood, setting, and recognizable film cues.${questionBlock}
If this is clearly a known movie poster or screenshot, extract the exact title and year.
Respond with ONLY raw JSON (no markdown fences):
{
  "description": "one vivid sentence describing the image and its cinematic mood",
  "genres": ["up to 3 TMDB genre names e.g. Science Fiction, Horror, Action"],
  "keywords": ["3-6 visual/theme keywords"],
  "moodTags": ["2-4 mood words e.g. moody, vibrant, gritty"],
  "exactTitle": "exact movie/show title if recognizable, else null",
  "exactYear": "YYYY release year if known, else null",
  "isKnownPoster": true or false
}`;

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
        ],
      },
    ],
  });

  const rawText = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      description: parsed.description || "A visually distinct image.",
      genres: parsed.genres || [],
      keywords: parsed.keywords || [],
      moodTags: parsed.moodTags || [],
      exactTitle: parsed.exactTitle || null,
      exactYear: parsed.exactYear || null,
      isKnownPoster: !!parsed.isKnownPoster,
    };
  } catch {
    return {
      description: "A visually distinct image with cinematic qualities.",
      genres: [],
      keywords: [],
      moodTags: [],
      exactTitle: null,
      exactYear: null,
      isKnownPoster: false,
    };
  }
}

async function groqChat(messages: Array<{ role: string; content: string }>, model?: string): Promise<string> {
  const groqKey = getApiKey("groq").replace(/\/$/, "");
  if (!groqKey) throw new Error("Groq API key not configured");

  const aiModel = model || db.data.site_settings?.aiModel || "llama-3.1-8b-instant";

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    let detail = `Groq returned status ${groqResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
      /* keep generic */
    }
    throw new Error(detail);
  }

  const groqData = await groqResponse.json();
  return groqData.choices?.[0]?.message?.content || "I couldn't formulate an answer right now.";
}

function resolveSessionUser(req: express.Request) {
  const userId = getOptionalUserId(req as AuthedRequest);
  return userId ? getUserById(userId) : undefined;
}

function buildAssistantSystemPrompt(opts: {
  movieContext?: any;
  visualContext?: any;
  sessionUser?: ReturnType<typeof getUserById>;
}): string {
  const settings = db.data.site_settings || {};
  let systemPrompt =
    'You are "All Kiki\'s", the official Cinemax AI Agent — expert, friendly, and deeply knowledgeable about every feature on the Cinemax website.\n\n';
  systemPrompt += buildCinemaxKnowledgeBase();
  systemPrompt += "\n\nRESPONSE STYLE: Cinematic, engaging, concise. Use bullets or bold for lists. Match the user's language exactly (including fluent Kinyarwanda).\n";
  systemPrompt +=
    "SITE ACTIONS: When the user explicitly requests a settings change, end with ONE ```action\\n{JSON}\\n``` block. Valid types: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help). Only one action block when clearly requested.\n";

  if (settings.aiSystemPromptExtra) {
    systemPrompt += `\n\nADMIN CUSTOM INSTRUCTIONS:\n${settings.aiSystemPromptExtra}`;
  }

  const u = opts.sessionUser;
  if (u) {
    systemPrompt += `\n\n[SIGNED-IN USER: ${u.name} (${u.email}), role: ${u.role}, subscription: ${u.subscription || "Free"}]`;
    if (u.role === "admin") {
      systemPrompt += `\nThis user is a CINEMAX ADMINISTRATOR with access to the Admin Panel. Address them professionally. Help with site management, content curation, Help Desk inquiries, broadcasts, and admin workflows. Never expose secrets.`;
      if (isAdminEmail(u.email)) {
        systemPrompt += `\nThis is the PRIMARY platform owner (allkikisweb@gmail.com) — highest priority for admin guidance.`;
      }
    }
    try {
      const prefs = JSON.parse(u.preferences || "{}");
      systemPrompt += `\nUser preferences snapshot: appLanguage=${prefs.appLanguage || "English"}, autoplayNext=${prefs.autoplayNext}, defaultQuality=${prefs.defaultQuality}, subtitleLanguage=${prefs.subtitleLanguage}.`;
    } catch {
      /* ignore */
    }
  } else {
    systemPrompt += "\n\n[VISITOR: Not signed in — guest browsing or anonymous. Remind them to sign in for downloads, My List, and profile features when relevant.]";
  }

  if (opts.visualContext) {
    systemPrompt += `\n\n[VISUAL SEARCH CONTEXT — user uploaded an image]\nImage analysis: ${opts.visualContext.description}`;
    if (opts.visualContext.analysis) {
      systemPrompt += `\nGenres: ${(opts.visualContext.analysis.genres || []).join(", ")}`;
      systemPrompt += `\nMood: ${(opts.visualContext.analysis.moodTags || []).join(", ")}`;
    }
    if (opts.visualContext.matches?.length) {
      systemPrompt += `\nMatched titles:\n${opts.visualContext.matches
        .map((m: any, i: number) => `${i + 1}. ${m.title} (TMDB #${m.id})${m.rating ? ` — ${m.rating}/10` : ""}`)
        .join("\n")}`;
    }
    systemPrompt += "\nAnswer follow-up questions about these matches with specific references to the list above.";
  }

  if (opts.movieContext) {
    systemPrompt += `\n\n[CURRENT TITLE: "${opts.movieContext.title || opts.movieContext.name || "Unknown"}"]`;
    if (opts.movieContext.overview) systemPrompt += `\nOverview: ${opts.movieContext.overview}`;
    if (opts.movieContext.vote_average) systemPrompt += `\nRating: ${opts.movieContext.vote_average}/10`;
  }

  return systemPrompt;
}

// (dotenv is loaded via the side-effect import above, before any other
// module — including server/mailer.ts — reads from process.env.)

// Ensure exactly one administrator account exists (see server/auth.ts for
// how the password is hashed — the plaintext is never persisted or logged).
seedAdminUser();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy so Secure cookies work behind Render / any HTTPS terminator.
  app.set("trust proxy", 1);

  // CORS — allowlist driven by env var CORS_ORIGIN (comma-separated).
  // Example: CORS_ORIGIN=https://cinemax.infinityfreeapp.com,https://admin.cinemax.infinityfreeapp.com
  // In dev, defaults to the two local Vite ports.
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/tools (no Origin header) and any allowlisted origin.
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Body parsing + cookie parsing. Raised limit for base64 attachments.
  app.use(express.json({ limit: "6mb" }));
  app.use(cookieParser());


  // Authentication, watchlist, favorites, and notifications endpoints
  app.use(authRouter);

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Movie Assistant (Groq-powered "All Kiki's") — full site knowledge + admin awareness
  app.post("/api/assistant", async (req, res) => {
    try {
      const { message, history = [], movieContext, visualContext } = req.body;

      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      if (db.data.site_settings?.aiEnabled === false) {
        res.status(503).json({ error: "The AI assistant is temporarily disabled by the administrator." });
        return;
      }

      if (!getApiKey("groq")) {
        res.status(500).json({ error: "AI assistant is not configured. Add GROQ API key in Admin → API Keys." });
        return;
      }

      const sessionUser = resolveSessionUser(req);
      const systemPrompt = buildAssistantSystemPrompt({ movieContext, visualContext, sessionUser });

      const messages: Array<{ role: string; content: string }> = [{ role: "system", content: systemPrompt }];
      history.forEach((h: any) => {
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.text || h.content || "",
        });
      });
      messages.push({ role: "user", content: message });

      const reply = await groqChat(messages);
      res.json({ text: reply });
    } catch (error: any) {
      console.error("Groq Assistant Error:", error);
      res.status(500).json({ error: error?.message || "Failed to communicate with All Kiki's AI Assistant." });
    }
  });

  // Legacy analysis-only endpoint (kept for compatibility)
  app.post("/api/visual-search", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required" });
        return;
      }
      if (!getApiKey("gemini")) {
        res.status(500).json({ error: "Visual search is not configured. Add Gemini API key in Admin → API Keys." });
        return;
      }
      const analysis = await analyzeImageWithGemini(imageBase64, mimeType);
      res.json(analysis);
    } catch (error: any) {
      console.error("Visual Search Error:", error);
      res.status(500).json({ error: error?.message || "Failed to analyze the image." });
    }
  });

  // Full visual search: Gemini vision + TMDB matching + optional AI Q&A
  app.post("/api/visual-search/match", async (req, res) => {
    try {
      const { imageBase64, mimeType, question } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required" });
        return;
      }
      if (!getApiKey("gemini")) {
        res.status(500).json({ error: "Visual search is not configured. Add Gemini API key in Admin → API Keys." });
        return;
      }

      const analysis = await analyzeImageWithGemini(imageBase64, mimeType, question);
      const matches = await matchMoviesFromAnalysis(analysis);

      let aiAnswer: string | undefined;
      if (question?.trim() && getApiKey("groq")) {
        const sessionUser = resolveSessionUser(req);
        const visualContext = {
          description: analysis.description,
          analysis,
          matches: matches.slice(0, 8).map((m) => ({
            id: m.id,
            title: m.title || m.name,
            overview: m.overview,
            rating: m.vote_average,
          })),
        };
        const systemPrompt = buildAssistantSystemPrompt({ visualContext, sessionUser });
        aiAnswer = await groqChat([
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `The user uploaded an image and asked: "${question.trim()}". Based on the visual analysis and matched titles, give a helpful, specific answer.`,
          },
        ]);
      }

      res.json({
        description: analysis.description,
        analysis,
        matches,
        aiAnswer,
      });
    } catch (error: any) {
      console.error("Visual Search Match Error:", error);
      res.status(500).json({ error: error?.message || "Visual search failed." });
    }
  });

  // Admin Panel API — every route here additionally requires role === "admin".
  // Mounted AFTER every other API route: its internal `.use(requireAuth,
  // requireAdmin)` has no path prefix, so it would otherwise intercept (and
  // 401) any request that isn't matched above it — including /api/health,
  // /api/assistant, and /api/visual-search.
  app.use(adminRouter);

  // Root: a tiny status page so hitting the Render URL in a browser gives
  // a friendly response instead of "Cannot GET /".
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Cinemax backend API — see /api/health");
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cinemax backend API listening on :${PORT}`);
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ") || "(none)"}`);
  });
}

startServer();
