import addCors from '@/pages/api/utils/addCors';
import fs from 'fs/promises';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/ngrok-path.page.ts';

type NgrokPathFile = { path?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const jsonPath = path.join(process.cwd(), 'ngrok_path.json');

  try {
    const raw = await fs.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as NgrokPathFile;
    const url = parsed.path;

    if (typeof url !== 'string' || !url.trim()) {
      return res
        .status(500)
        .json({ message: 'Invalid ngrok_path.json: missing path' });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(url.trim());
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return res.status(404).json({ message: 'ngrok_path.json not found' });
    }
    if (err instanceof SyntaxError) {
      return res.status(500).json({ message: 'Invalid ngrok_path.json' });
    }
    console.error(`${filepath} GET:`, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
