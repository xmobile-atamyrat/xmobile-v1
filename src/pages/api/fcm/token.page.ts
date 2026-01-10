import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/fcm/token.page.ts';

const RegisterTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  deviceInfo: z.string().min(1, 'Device info is required'),
});

const DeleteTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, body } = req;
  const { userId } = req as AuthenticatedRequest;

  if (method === 'POST') {
    // Register or update FCM token
    try {
      const validated = RegisterTokenSchema.parse(body);
      const { token, deviceInfo } = validated;

      // Check if token already exists
      const existingToken = await dbClient.fCMToken.findUnique({
        where: { token },
      });

      if (existingToken) {
        // Update existing token if it belongs to this user, or if it's inactive
        if (existingToken.userId === userId || !existingToken.isActive) {
          // Deactivate all other tokens for this device and user
          await dbClient.fCMToken.updateMany({
            where: {
              userId,
              deviceInfo,
              id: { not: existingToken.id },
            },
            data: {
              isActive: false,
            },
          });

          await dbClient.fCMToken.update({
            where: { token },
            data: {
              userId,
              deviceInfo,
              isActive: true,
              lastUsedAt: new Date(),
              failureCount: 0,
            },
          });

          return res.status(200).json({
            success: true,
            message: 'Token updated successfully',
          });
        }
        // Token belongs to another user
        return res.status(400).json({
          success: false,
          message: 'Token already registered to another user',
        });
      }

      // Deactivate all other tokens for this device and user (ensure one token per device)
      await dbClient.fCMToken.updateMany({
        where: {
          userId,
          deviceInfo,
        },
        data: {
          isActive: false,
        },
      });

      // Create new token
      await dbClient.fCMToken.create({
        data: {
          userId,
          token,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Token registered successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        });
      }
      console.error(filepath, 'Error registering token:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to register token',
      });
    }
  } else if (method === 'DELETE') {
    // Unregister FCM token
    try {
      const validated = DeleteTokenSchema.parse(body);

      const token = await dbClient.fCMToken.findUnique({
        where: { token: validated.token },
      });

      if (!token) {
        return res.status(404).json({
          success: false,
          message: 'Token not found',
        });
      }

      if (token.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Token does not belong to this user',
        });
      }

      await dbClient.fCMToken.update({
        where: { token: validated.token },
        data: {
          isActive: false,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Token unregistered successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        });
      }
      console.error(filepath, 'Error unregistering token:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to unregister token',
      });
    }
  } else if (method === 'PATCH') {
    // Deactivate all tokens for user (soft delete on logout)
    try {
      await dbClient.fCMToken.updateMany({
        where: { userId },
        data: {
          isActive: false,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'All tokens deactivated successfully',
      });
    } catch (error: any) {
      console.error(filepath, 'Error deactivating tokens:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to deactivate tokens',
      });
    }
  } else if (method === 'GET') {
    // Get user's tokens (for debugging)
    try {
      const tokens = await dbClient.fCMToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
          deviceInfo: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      console.error(filepath, 'Error fetching tokens:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch tokens',
      });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }
}

export default withAuth(handler);
