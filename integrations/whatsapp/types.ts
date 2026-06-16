export type WhatsAppMessage = { to: string; template: string; variables?: Record<string, string> };
export type WhatsAppResult = { messageId: string; status: "mocked" };

export interface WhatsAppProvider {
  send(message: WhatsAppMessage): Promise<WhatsAppResult>;
}
