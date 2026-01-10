import { NotificationType } from '@prisma/client';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data: {
    notificationId: string;
    type: NotificationType;
    sessionId?: string;
    orderId?: string;
    click_action: string;
  };
}

export interface FCMSendResult {
  success: boolean;
  tokensSent: number;
  tokensFailed: number;
  failedTokenIds: string[];
}
