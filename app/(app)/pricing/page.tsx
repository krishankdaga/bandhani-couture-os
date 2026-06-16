
import { Phase2Card } from "@/components/phase2-card";

export default function Page() {
  return (
    <Phase2Card
      title="Pricing Calculator"
      description="Calculate couture pricing using fabric, embroidery, stitching, overhead and margin."
      endpoint="/api/pricing"
      listKey="templates"
      fields={[
        { name: "name", label: "Piece Name", placeholder: "Custom lehenga" },
        { name: "baseCost", label: "Base Cost", type: "number", defaultValue: "0" },
        { name: "fabricCost", label: "Fabric Cost", type: "number", defaultValue: "0" },
        { name: "embroideryCost", label: "Embroidery Cost", type: "number", defaultValue: "0" },
        { name: "stitchingCost", label: "Stitching Cost", type: "number", defaultValue: "0" },
        { name: "overheadPercent", label: "Overhead %", type: "number", defaultValue: "20" },
        { name: "marginPercent", label: "Margin %", type: "number", defaultValue: "35" },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
