import dbClient from '@/lib/dbClient';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import { MobilePlatforms, UserRole } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/app-version.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    try {
      const appVersion = await dbClient.appVersion.findUnique({
        where: { platform: MobilePlatforms.ALL },
      });

      if (!appVersion) {
        return res.status(200).json({
          hardMinVersion: '1.0.0',
          softMinVersion: '1.0.0',
        });
      }

      return res.status(200).json({
        hardMinVersion: appVersion.hardMinVersion,
        softMinVersion: appVersion.softMinVersion,
      });
    } catch (error) {
      console.error(`${filepath} GET:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Unauthorized: Missing or invalid Authorization header',
      });
    }

    const accessToken = authHeader.split(' ')[1];

    let grade: UserRole;
    try {
      const decoded = await verifyToken(accessToken, ACCESS_SECRET);
      grade = decoded.grade as UserRole;
    } catch {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    if (grade !== UserRole.SUPERUSER) {
      return res.status(403).json({ message: 'Forbidden: Superuser only' });
    }

    const { hardMinVersion, softMinVersion } = req.body as {
      hardMinVersion: string;
      softMinVersion: string;
    };

    if (!hardMinVersion || !softMinVersion) {
      return res
        .status(400)
        .json({ message: 'hardMinVersion and softMinVersion are required' });
    }

    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (
      !semverRegex.test(hardMinVersion) ||
      !semverRegex.test(softMinVersion)
    ) {
      return res
        .status(400)
        .json({ message: 'Versions must be in semver format: X.Y.Z' });
    }

    try {
      const appVersion = await dbClient.appVersion.upsert({
        where: { platform: MobilePlatforms.ALL },
        update: { hardMinVersion, softMinVersion },
        create: {
          platform: MobilePlatforms.ALL,
          hardMinVersion,
          softMinVersion,
        },
      });

      return res.status(200).json({ success: true, data: appVersion });
    } catch (error) {
      console.error(`${filepath} PUT:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
