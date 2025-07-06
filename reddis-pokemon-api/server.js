import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/pokemon/:name', async (req, res) => {
  const name = req.params.name.toLowerCase();
  const cacheKey = `pokemon:${name}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit:', name);
      return res.json(JSON.parse(cached));
    }

    console.log(' Fetching from API:', name);
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const lean = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.front_default,
      height: data.height,
      weight: data.weight,
      types: data.types.map(t => t.type.name),
      stats: Object.fromEntries(data.stats.map(s => [s.stat.name, s.base_stat])),
    };

    await redisClient.set(cacheKey, JSON.stringify(lean), { EX: 600 });
    res.json(lean);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch Pokémon.' });
  }
});

app.get('/api/list', async (_, res) => {
  try {
    const { data } = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=100');
    res.json(data.results.map((p) => p.name));
  } catch {
    res.status(500).json({ error: 'Could not fetch Pokémon list.' });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
