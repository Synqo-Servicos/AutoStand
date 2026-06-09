"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_SLUGS, PLANS, type PlanSlug } from "@/lib/plans";
import { normalizeSlug, slugError } from "@/lib/slug";
import { Turnstile, isTurnstileEnabled } from "@/components/Turnstile";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const inputClass =
  "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-body text-ink " +
  "placeholder-n400 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30";
const labelClass = "block text-body-s font-medium text-ink";

export function SignupForm({
  defaultPlan,
  partnerCode,
}: {
  defaultPlan: PlanSlug;
  partnerCode?: string;
}) {
  const router = useRouter();

  const [plan, setPlan] = useState<PlanSlug>(defaultPlan);
  const [dealershipName, setDealershipName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponState, setCouponState] = useState<
    | { status: "idle" }
    | { status: "validating" }
    | { status: "valid"; preview: string }
    | { status: "invalid"; error: string }
  >({ status: "idle" });

  const liveSlugError = slug ? slugError(slug) : null;
  const onCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  async function validateCoupon(code: string, currentPlan: PlanSlug) {
    if (!code.trim()) { setCouponState({ status: "idle" }); return; }
    setCouponState({ status: "validating" });
    try {
      const res = await fetch(`/api/cupons/validate?code=${encodeURIComponent(code)}&plan=${currentPlan}`);
      const data = await res.json();
      setCouponState(data.valid
        ? { status: "valid", preview: data.preview }
        : { status: "invalid", error: data.error ?? "Cupom inválido." });
    } catch {
      setCouponState({ status: "invalid", error: "Erro ao validar cupom." });
    }
  }
  const captchaEnabled = isTurnstileEnabled();
  const canSubmit = !submitting && (!captchaEnabled || captchaToken !== null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const slugErr = slugError(slug);
    if (slugErr) {
      setError(slugErr);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          slug,
          dealership_name: dealershipName,
          admin_name: adminName,
          admin_email: adminEmail,
          admin_password: adminPassword,
          partner_code: partnerCode ?? "",
          coupon_code: couponCode.trim().toUpperCase() || null,
          turnstile_token: captchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível concluir o cadastro.");
        setSubmitting(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.push(`/assinar/sucesso?loja=${encodeURIComponent(data.slug)}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Plano */}
      <fieldset>
        <legend className={labelClass}>Plano</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {PLAN_SLUGS.map((s) => {
            const selected = plan === s;
            return (
              <button
                type="button"
                key={s}
                onClick={() => setPlan(s)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? "border-signal bg-signal/10"
                    : "border-n200 bg-white hover:border-n400"
                }`}
              >
                <span className="block font-display font-semibold text-ink">
                  {PLANS[s].name}
                </span>
                <span className="block text-body-s text-n600">
                  {formatBRL(PLANS[s].priceMonthly)}/mês
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Concessionária */}
      <div className="space-y-4">
        <div>
          <label htmlFor="dealership_name" className={labelClass}>
            Nome da concessionária
          </label>
          <input
            id="dealership_name"
            className={`mt-1 ${inputClass}`}
            value={dealershipName}
            onChange={(e) => setDealershipName(e.target.value)}
            onBlur={() => {
              if (!slugTouched && !slug && dealershipName) {
                setSlug(normalizeSlug(dealershipName));
              }
            }}
            placeholder="Auto Center Silva"
            required
          />
        </div>

        <div>
          <label htmlFor="slug" className={labelClass}>
            Endereço do site
          </label>
          <div className="mt-1 flex items-center rounded-lg border border-n200 bg-white focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/30">
            <input
              id="slug"
              className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-body text-ink placeholder-n400 outline-none"
              value={slug}
              onChange={(e) => {
                setSlug(normalizeSlug(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="sualoja"
              required
            />
            <span className="select-none px-3 py-2 text-body-s text-n600">
              .autostand.com.br
            </span>
          </div>
          {liveSlugError && (
            <p className="mt-1 text-body-s text-danger">{liveSlugError}</p>
          )}
        </div>
      </div>

      {/* Admin */}
      <div className="space-y-4">
        <p className="text-body-s font-medium text-n600">Seus dados de acesso</p>
        <div>
          <label htmlFor="admin_name" className={labelClass}>
            Seu nome
          </label>
          <input
            id="admin_name"
            className={`mt-1 ${inputClass}`}
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="João Silva"
            required
          />
        </div>
        <div>
          <label htmlFor="admin_email" className={labelClass}>
            E-mail
          </label>
          <input
            id="admin_email"
            type="email"
            className={`mt-1 ${inputClass}`}
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="joao@sualoja.com.br"
            required
          />
        </div>
        <div>
          <label htmlFor="admin_password" className={labelClass}>
            Senha
          </label>
          <input
            id="admin_password"
            type="password"
            className={`mt-1 ${inputClass}`}
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            minLength={8}
            required
          />
        </div>
      </div>

      {/* Cupom (opcional) */}
      <div>
        <label htmlFor="coupon_code" className={labelClass}>
          Código de cupom <span className="text-n400 font-normal">(opcional)</span>
        </label>
        <input
          id="coupon_code"
          className={`mt-1 font-mono uppercase ${inputClass} ${
            couponState.status === "valid" ? "border-green-500 focus:border-green-500 focus:ring-green-500/30" :
            couponState.status === "invalid" ? "border-danger focus:border-danger focus:ring-danger/30" : ""
          }`}
          value={couponCode}
          onChange={(e) => {
            const val = e.target.value.toUpperCase().replace(/\s/g, "");
            setCouponCode(val);
            if (!val) setCouponState({ status: "idle" });
          }}
          onBlur={() => validateCoupon(couponCode, plan)}
          placeholder="PROMO10"
          autoComplete="off"
        />
        {couponState.status === "validating" && (
          <p className="mt-1 text-body-s text-n400">Validando…</p>
        )}
        {couponState.status === "valid" && (
          <p className="mt-1 text-body-s text-green-600">✓ {couponState.preview}</p>
        )}
        {couponState.status === "invalid" && (
          <p className="mt-1 text-body-s text-danger">{couponState.error}</p>
        )}
      </div>

      {captchaEnabled && <Turnstile onVerify={setCaptchaToken} onExpire={onCaptchaExpire} />}

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-body-s text-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || !!liveSlugError}
        className="w-full rounded-lg bg-signal px-4 py-3 font-semibold text-ink transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Criar minha conta"}
      </button>
      <p className="text-body-s text-n600">
        O site entra no ar após a confirmação do primeiro pagamento.
      </p>
    </form>
  );
}
