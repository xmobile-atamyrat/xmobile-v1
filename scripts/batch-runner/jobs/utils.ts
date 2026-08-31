import { getSlack } from '@/lib/slack';

export async function sendSlackAlert(
  message: string,
  slackBotName: string,
): Promise<void> {
  try {
    const slack = getSlack(slackBotName);
    if (!slack) {
      console.error(
        `[SystemResources] Slack client '${slackBotName}' not found. Check SLACK_HEALTH_BOT_WEBHOOK env var.`,
      );
      return;
    }

    await slack.send(message);
    console.log('[SystemResources] Slack alert sent.');
  } catch (error) {
    console.error('[SystemResources] Failed to send Slack alert:', error);
  }
}
