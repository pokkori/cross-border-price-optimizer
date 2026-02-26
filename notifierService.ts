import { ProfitCalculationError } from './types'; // Re-using for general errors

const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN || 'YOUR_LINE_NOTIFY_TOKEN';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL';

interface NotificationOptions {
    productName: string;
    estimatedProfit: number;
    profitMargin: number;
    dashboardLink: string;
    messagePrefix?: string;
}

export class Notifier {
    private lineNotifyToken: string;
    private slackWebhookUrl: string;

    constructor() {
        this.lineNotifyToken = LINE_NOTIFY_TOKEN;
        this.slackWebhookUrl = SLACK_WEBHOOK_URL;
    }

    private async sendLineNotification(message: string): Promise<void> {
        if (this.lineNotifyToken === 'YOUR_LINE_NOTIFY_TOKEN' || !this.lineNotifyToken) {
            console.warn("[Notifier] LINE Notify token is not set. Skipping LINE notification.");
            return;
        }

        try {
            const response = await fetch('https://notify-api.line.me/api/notify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.lineNotifyToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `message=${encodeURIComponent(message)}`,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("[Notifier] Failed to send LINE notification:", errorData);
                throw new ProfitCalculationError(`LINE Notify error: ${errorData.message}`);
            }
            console.log("[Notifier] LINE notification sent successfully.");
        } catch (error: any) {
            console.error("[Notifier] Error sending LINE notification:", error);
            // Don't re-throw, allow other notifications to proceed
        }
    }

    private async sendSlackNotification(message: string): Promise<void> {
        if (this.slackWebhookUrl === 'YOUR_SLACK_WEBHOOK_URL' || !this.slackWebhookUrl) {
            console.warn("[Notifier] Slack Webhook URL is not set. Skipping Slack notification.");
            return;
        }

        try {
            const response = await fetch(this.slackWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: message }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[Notifier] Failed to send Slack notification:", response.status, errorText);
                throw new ProfitCalculationError(`Slack Webhook error: ${response.status} - ${errorText}`);
            }
            console.log("[Notifier] Slack notification sent successfully.");
        } catch (error: any) {
            console.error("[Notifier] Error sending Slack notification:", error);
            // Don't re-throw
        }
    }

    public async sendProfitNotification(options: NotificationOptions): Promise<void> {
        const { productName, estimatedProfit, profitMargin, dashboardLink, messagePrefix } = options;

        const baseMessage = `${messagePrefix || '🌟 新しい高利益商品を発見! 🌟'}
商品名: ${productName}
推定利益: ${estimatedProfit.toLocaleString()} JPY
利益率: ${(profitMargin * 100).toFixed(2)}%
ダッシュボードで確認: ${dashboardLink}`;

        // Send to LINE
        await this.sendLineNotification(baseMessage);

        // Send to Slack
        await this.sendSlackNotification(baseMessage);
    }

    /**
     * サマリー通知用の汎用メッセージ送信関数。
     * プロダクト単位ではなく「本日の上位3件」などをまとめて送りたい場合に使用する。
     */
    public async sendSummaryNotification(message: string): Promise<void> {
        await this.sendLineNotification(message);
        await this.sendSlackNotification(message);
    }

    /**
     * 緊急通知（連続失敗時など）を管理者に送信する専用関数。
     * 利益通知とは異なるフォーマットで送信する。
     */
    public async sendEmergencyNotification(options: {
        workflowName: string;
        consecutiveFailures: number;
        dashboardLink: string;
    }): Promise<void> {
        const message = `🚨 緊急通知 🚨\n` +
            `ワークフロー「${options.workflowName}」が ${options.consecutiveFailures} 回連続で失敗しています。\n` +
            `すぐに確認してください。\n` +
            `ダッシュボード: ${options.dashboardLink}`;

        await this.sendLineNotification(message);
        await this.sendSlackNotification(message);
    }
}
