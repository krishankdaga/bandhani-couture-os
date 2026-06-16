import { MockWhatsAppProvider } from "./mock-provider";

export const whatsapp = new MockWhatsAppProvider();
export type { WhatsAppMessage, WhatsAppProvider, WhatsAppResult } from "./types";
