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
    // Handles 8 scenarios based on token/deviceInfo/user combinations
    try {
      const validated = RegisterTokenSchema.parse(body);
      const { token, deviceInfo } = validated;

      // SCENARIO CHECK 1: Check if deviceInfo exists for current user
      const existingDeviceForUser = await dbClient.fCMToken.findUnique({
        where: { deviceInfo },
      });

      if (existingDeviceForUser) {
        // DeviceInfo exists - check ownership
        if (existingDeviceForUser.userId === userId) {
          // Scenario 1.a: Token exists, DeviceInfo exists, User matches → UPDATE
          // Scenario 1.b: Token doesn't exist, DeviceInfo exists, User matches → UPDATE
          // Update the token for this device (token refresh/expiration)
          await dbClient.fCMToken.update({
            where: { deviceInfo },
            data: { token },
          });

          return res.status(200).json({
            success: true,
            message: 'Token updated successfully',
          });
        }
        // Scenario 2 & 6: DeviceInfo exists but belongs to another user → REASSIGN
        // This happens when a different user logs in on the same device (shared/family device,
        // or logout→login flow). Reassign the device to the current user.
        await dbClient.fCMToken.update({
          where: { deviceInfo },
          data: { token, userId },
        });

        return res.status(200).json({
          success: true,
          message: 'Device reassigned to current user',
        });
      }

      // SCENARIO CHECK 2: DeviceInfo doesn't exist - check if token belongs to another user
      // Scenarios: DeviceInfo is new, need to check token ownership
      const existingToken = await dbClient.fCMToken.findUnique({
        where: { token },
      });

      if (existingToken) {
        // Token exists - check ownership
        if (existingToken.userId !== userId) {
          // Scenario 2.a: Token exists, DeviceInfo doesn't exist, User doesn't match → REJECT
          return res.status(400).json({
            success: false,
            message: 'Token already registered to another user',
          });
        }
        // Scenario 2.b: Token exists, DeviceInfo doesn't exist, User matches → CREATE
        // This is valid - user is adding a new device with an existing token
        // (unlikely but possible if token was reused)
      }

      // SCENARIO 3: Token doesn't exist, DeviceInfo doesn't exist → CREATE
      // Create new token record (first-time registration)
      await dbClient.fCMToken.create({
        data: {
          userId,
          token,
          deviceInfo,
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

      await dbClient.fCMToken.delete({
        where: { token: validated.token },
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
  } else if (method === 'GET') {
    // Get user's tokens (for debugging)
    try {
      const tokens = await dbClient.fCMToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
          deviceInfo: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Mask tokens for security - only show first 20 and last 4 characters
      const maskedTokens = tokens.map((t) => ({
        ...t,
        token:
          t.token.length > 24
            ? `${t.token.substring(0, 20)}...${t.token.substring(t.token.length - 4)}`
            : '***masked***',
      }));

      return res.status(200).json({
        success: true,
        data: maskedTokens,
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
