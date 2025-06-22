import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { filename } = req.query;
  const filePath = path.join(process.cwd(), 'ssl_keys', `${filename}`);

  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(contents);
  } catch (error) {
    res.status(404).send('File not found');
  }
}
