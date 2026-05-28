import {
  Award,
  BadgeCheck,
  Clock,
  CreditCard,
  FileCheck,
  Gauge,
  Handshake,
  Heart,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AboutIcon } from "@/lib/schemas";

/**
 * Map de slug → componente Lucide pra seção "Sobre" da vitrine pública.
 * Mantém a allowlist (zod) e a renderização sincronizadas — qualquer ícone
 * adicionado em `ABOUT_ICONS` precisa aparecer aqui também.
 */
export const ABOUT_ICON_MAP: Record<AboutIcon, LucideIcon> = {
  ShieldCheck,
  Handshake,
  CreditCard,
  MessageCircle,
  Wrench,
  Award,
  Truck,
  Clock,
  PhoneCall,
  Star,
  Heart,
  ThumbsUp,
  Sparkles,
  Gauge,
  MapPin,
  Users,
  FileCheck,
  BadgeCheck,
};

/** Resolve um slug qualquer (de DB) para ícone, com fallback seguro. */
export function iconForSlug(slug: string | null | undefined): LucideIcon {
  if (slug && slug in ABOUT_ICON_MAP) return ABOUT_ICON_MAP[slug as AboutIcon];
  return ShieldCheck;
}
