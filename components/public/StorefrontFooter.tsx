import type { TenantRow } from "@/lib/schema";

type Props = {
  tenant: TenantRow;
  waHref: string;
};

export function StorefrontFooter({ tenant, waHref }: Props) {
  const hasSocial =
    !!tenant.whatsapp_number ||
    !!tenant.instagram_url ||
    !!tenant.facebook_url ||
    !!tenant.youtube_url ||
    !!tenant.tiktok_url ||
    !!tenant.twitter_url;

  if (!hasSocial && !tenant.contact_email) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--brand-primary)] py-10 px-4 text-center">
      {hasSocial && (
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {tenant.whatsapp_number && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              WhatsApp
            </a>
          )}
          {tenant.instagram_url && (
            <a
              href={tenant.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              Instagram
            </a>
          )}
          {tenant.facebook_url && (
            <a
              href={tenant.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              Facebook
            </a>
          )}
          {tenant.youtube_url && (
            <a
              href={tenant.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              YouTube
            </a>
          )}
          {tenant.tiktok_url && (
            <a
              href={tenant.tiktok_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              TikTok
            </a>
          )}
          {tenant.twitter_url && (
            <a
              href={tenant.twitter_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 hover:border-white/80 text-white text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              Twitter / X
            </a>
          )}
        </div>
      )}

      {tenant.contact_email && (
        <a
          href={`mailto:${tenant.contact_email}`}
          className="text-white/70 text-sm hover:text-white transition-colors"
        >
          {tenant.contact_email}
        </a>
      )}

      <p className="text-white/40 text-xs mt-4">
        &copy; {year} {tenant.name}
      </p>
    </footer>
  );
}
