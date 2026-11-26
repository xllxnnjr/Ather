import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CatalogTrackInput {
  id: string;
  title: string;
  artist: string;
  album: string;
  category: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(error: unknown, fallback: string): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : fallback;
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string };
      message?: string;
    };
    const msg = parsed?.error?.message ?? parsed?.message ?? raw;
    const code = parsed?.error?.code === 503 ? 503 : 500;
    return { status: code, message: msg };
  } catch {
    return { status: 500, message: raw || fallback };
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/smart-shuffle', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable AI Smart Shuffle.',
      });
      return;
    }

    const body = req.body as {
      currentTrackId?: string;
      seedTrackIds?: string[];
      candidateTrackIds?: string[];
      favoriteIds?: string[];
      recentTrackIds?: string[];
      discoveryLevel?: string;
      catalog?: CatalogTrackInput[];
    };

    const catalog = Array.isArray(body.catalog) ? body.catalog : [];
    const candidateIds = Array.isArray(body.candidateTrackIds)
      ? body.candidateTrackIds
      : catalog.map((t) => t.id);

    if (catalog.length === 0 || candidateIds.length === 0) {
      res.status(400).json({ error: 'No candidate tracks provided for AI Smart Shuffle.' });
      return;
    }

    const candidateSet = new Set(candidateIds);
    const candidates = catalog.filter((t) => candidateSet.has(t.id));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify({
          currentTrackId: body.currentTrackId ?? null,
          seedTrackIds: body.seedTrackIds ?? [],
          favoriteIds: body.favoriteIds ?? [],
          recentTrackIds: body.recentTrackIds ?? [],
          discoveryLevel: body.discoveryLevel ?? 'Balanced',
          candidates,
        }),
        config: {
          systemInstruction:
            'You are Ather AI Smart Shuffle, a music sequencing engine. Given a listener profile and candidate tracks, reorder all candidate track IDs into a smooth, cohesive listening sequence balancing sonic flow, mood transitions, and artist variety according to discoveryLevel. Only return IDs that exist in candidates, and keep the note concise (under 14 words).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              orderedTrackIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Reordered list of track IDs from the candidate list.',
              },
              note: {
                type: Type.STRING,
                description: 'Short description of the AI Smart Shuffle flow.',
              },
            },
            required: ['orderedTrackIds', 'note'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        orderedTrackIds?: string[];
        note?: string;
      };

      const validOrdered = (parsed.orderedTrackIds ?? []).filter((id) =>
        candidateSet.has(id)
      );
      for (const id of candidateIds) {
        if (!validOrdered.includes(id)) {
          validOrdered.push(id);
        }
      }

      res.json({
        orderedTrackIds: validOrdered,
        note: parsed.note ?? 'AI Smart Shuffle sequenced your queue',
      });
    } catch (error) {
      const { status, message } = formatGeminiError(error, 'AI Smart Shuffle request failed.');
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/recommendations', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to generate AI Recommendations.',
      });
      return;
    }

    const body = req.body as {
      recentTrackIds?: string[];
      favoriteIds?: string[];
      discoveryLevel?: string;
      catalog?: CatalogTrackInput[];
    };

    const catalog = Array.isArray(body.catalog) ? body.catalog : [];
    if (catalog.length === 0) {
      res.status(400).json({ error: 'Catalog tracks are required for recommendations.' });
      return;
    }

    const validIds = new Set(catalog.map((t) => t.id));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify({
          recentTrackIds: body.recentTrackIds ?? [],
          favoriteIds: body.favoriteIds ?? [],
          discoveryLevel: body.discoveryLevel ?? 'Balanced',
          catalog,
        }),
        config: {
          systemInstruction:
            'You are Ather AI Recommendations. Select exactly 4 recommended tracks from the catalog tailored to the user’s recent plays, favorites, and discoveryLevel ("Familiar Hits", "Balanced", or "Deep Cuts"). Only return trackIds from the catalog, with a short 2-3 word vibeTag and a concise 1-sentence reason.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: 'Short editorial shelf title under 6 words.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    trackId: { type: Type.STRING },
                    vibeTag: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['trackId', 'vibeTag', 'reason'],
                },
              },
            },
            required: ['headline', 'recommendations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        headline?: string;
        recommendations?: { trackId: string; vibeTag: string; reason: string }[];
      };

      const filtered = (parsed.recommendations ?? []).filter((item) =>
        validIds.has(item.trackId)
      );

      res.json({
        headline: parsed.headline ?? 'AI Curated Mix',
        recommendations: filtered.slice(0, 4),
      });
    } catch (error) {
      const { status, message } = formatGeminiError(error, 'AI Recommendations request failed.');
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ather server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
