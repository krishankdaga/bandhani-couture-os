
import { Phase2Card } from "@/components/phase2-card";

export default function Page() {
  return (
    <Phase2Card
      title="WhatsApp Automation"
      description="Prepare reminder templates for stylists, production teams and owners."
      endpoint="/api/whatsapp"
      listKey="templates"
      fields={[
        { name: "name", label: "Template Name", placeholder: "Morning stylist follow-up" },
        { name: "type", label: "Template Type", options: ["STYLIST_FOLLOW_UP", "PRODUCTION_REMINDER", "DELAY_ALERT", "DAILY_OWNER_SUMMARY"], defaultValue: "STYLIST_FOLLOW_UP" },
        { name: "message", label: "Message", placeholder: "Good morning, please follow up with..." },
      ]}
    />
  );
}
