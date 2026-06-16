import { WhatsAppMessage, WhatsAppProvider, WhatsAppResult } from "./types";

export class MockWhatsAppProvider implements WhatsAppProvider {
  async send(message: WhatsAppMessage): Promise<WhatsAppResult> {
    // Keep message delivery behind this adapter so a real provider can replace it later.
    console.info("[WhatsApp mock]", message);
    return { messageId: `mock-${Date.now()}`, status: "mocked" };
  }
}
