"use client";

import { MessageCircle } from "lucide-react";
import { useTenant } from "@/components/TenantContext";
import { waHref as toWaHref } from "@/lib/whatsapp";

export function WhatsAppFAB() {
  const tenant = useTenant();
  if (!tenant.whatsapp_number) return null;

  return (
    <a
      href={toWaHref(tenant.whatsapp_number) ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
    >
      <MessageCircle className="w-6 h-6 fill-white" />
    </a>
  );
}
