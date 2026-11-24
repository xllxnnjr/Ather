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

  const MUSICBRAINZ_HEADERS = {
    'User-Agent': 'ATHERAudioApp/2.4 (help@ather.audio)',
    Accept: 'application/json',
  };

  app.get('/api/apple-charts/songs', async (req, res) => {
    const rawCountry =
      typeof req.query.country === 'string'
        ? req.query.country.trim().toLowerCase().replace(/[^a-z]/g, '')
        : 'us';
    const country = rawCountry.length === 2 ? rawCountry : 'us';
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(5, Math.min(50, Math.round(rawLimit)))
      : 50;

    try {
      const upstream = await fetch(
        `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${limit}/songs.json`
      );
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Apple charts returned ${upstream.status}` });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to fetch Apple song charts.',
      });
    }
  });

  app.get('/api/apple-charts/albums', async (req, res) => {
    const rawCountry =
      typeof req.query.country === 'string'
        ? req.query.country.trim().toLowerCase().replace(/[^a-z]/g, '')
        : 'us';
    const country = rawCountry.length === 2 ? rawCountry : 'us';
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(5, Math.min(50, Math.round(rawLimit)))
      : 25;

    try {
      const upstream = await fetch(
        `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${limit}/albums.json`
      );
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Apple album charts returned ${upstream.status}` });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to fetch Apple album charts.',
      });
    }
  });

  app.get('/api/youtube/free-search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    const parseDurationSeconds = (rawText?: string): number | undefined => {
      if (!rawText) return undefined;
      const parts = rawText
        .trim()
        .split(':')
        .map((n) => Number(n));
      if (parts.some((n) => !Number.isFinite(n))) return undefined;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return undefined;
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3200);
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const upstream = await fetch(ytUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.json({ items: [] });
        return;
      }

      const html = await upstream.text();
      const marker = 'var ytInitialData = ';
      const start = html.indexOf(marker);
      if (start === -1) {
        res.json({ items: [] });
        return;
      }

      const jsonStart = start + marker.length;
      const end = html.indexOf(';</script>', jsonStart);
      if (end === -1) {
        res.json({ items: [] });
        return;
      }

      const rawData = JSON.parse(html.slice(jsonStart, end)) as unknown;
      const items: {
        videoId: string;
        title: string;
        channelTitle: string;
        verified?: boolean;
        durationSec?: number;
        thumbnailUrl?: string;
      }[] = [];
      const seen = new Set<string>();

      const walk = (node: unknown) => {
        if (!node || typeof node !== 'object' || items.length >= 20) return;
        if (Array.isArray(node)) {
          for (const el of node) walk(el);
          return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.videoRenderer && typeof rec.videoRenderer === 'object') {
          const vr = rec.videoRenderer as {
            videoId?: string;
            title?: { runs?: { text?: string }[]; simpleText?: string };
            ownerText?: { runs?: { text?: string }[] };
            longBylineText?: { runs?: { text?: string }[] };
            ownerBadges?: Array<{
              metadataBadgeRenderer?: { style?: string; tooltip?: string };
            }>;
            lengthText?: { simpleText?: string };
            thumbnail?: { thumbnails?: { url?: string }[] };
          };
          const videoId = vr.videoId?.trim();
          const title =
            vr.title?.runs?.map((r) => r.text ?? '').join('').trim() ||
            vr.title?.simpleText?.trim();
          const channelTitle =
            vr.ownerText?.runs?.[0]?.text?.trim() ||
            vr.longBylineText?.runs?.[0]?.text?.trim() ||
            '';
          const verified = Boolean(
            vr.ownerBadges?.some((b) => {
              const style = b.metadataBadgeRenderer?.style ?? '';
              const tooltip = b.metadataBadgeRenderer?.tooltip ?? '';
              return (
                style.includes('OFFICIAL_ARTIST') ||
                style.includes('VERIFIED') ||
                /official artist|verified/i.test(tooltip)
              );
            })
          );
          const thumbs = vr.thumbnail?.thumbnails;
          const thumbnailUrl = thumbs?.[thumbs.length - 1]?.url;
          if (videoId && title && !seen.has(videoId)) {
            seen.add(videoId);
            items.push({
              videoId,
              title,
              channelTitle,
              verified,
              durationSec: parseDurationSeconds(vr.lengthText?.simpleText),
              thumbnailUrl: thumbnailUrl?.startsWith('http')
                ? thumbnailUrl
                : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            });
          }
          return;
        }
        for (const val of Object.values(rec)) {
          walk(val);
        }
      };

      walk(rawData);
      res.json({ items });
    } catch {
      res.json({ items: [] });
    }
  });

  app.get('/api/audiometa/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    const apiKey = process.env.AUDIOMETA_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ items: [], error: 'AUDIOMETA_API_KEY is not configured.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3200);
      const upstream = await fetch(
        `https://api.audiometa.com/v1/tracks?q=${encodeURIComponent(q)}`,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        }
      );
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(upstream.status).json({ items: [] });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch {
      res.status(502).json({ items: [] });
    }
  });

  app.get('/api/musicbrainz/artist', async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Artist name query is required.' });
      return;
    }
    try {
      const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(
        `artist:"${name}"`
      )}&fmt=json&limit=3`;
      const upstream = await fetch(url, { headers: MUSICBRAINZ_HEADERS });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `MusicBrainz artist lookup failed (${upstream.status})` });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Unable to reach MusicBrainz.',
      });
    }
  });

  app.get('/api/musicbrainz/recording', async (req, res) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
    if (!title) {
      res.status(400).json({ error: 'Track title query is required.' });
      return;
    }
    try {
      const query = artist
        ? `recording:"${title}" AND artist:"${artist}"`
        : `recording:"${title}"`;
      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
        query
      )}&fmt=json&limit=3`;
      const upstream = await fetch(url, { headers: MUSICBRAINZ_HEADERS });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `MusicBrainz recording lookup failed (${upstream.status})` });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Unable to reach MusicBrainz.',
      });
    }
  });

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
