"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { CARE_SERVICES } from "@/lib/care-services";
import { submitLead } from "@/lib/leads";
import FormPrivacyNote from "@/components/site/FormPrivacyNote";

type Kind = "care" | "consulting" | "careers";

export default function InquiryForm({
  kind = "care",
  compact = false,
  defaultService = "Not sure yet",
}: {
  kind?: Kind;
  compact?: boolean;
  defaultService?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limited">(
    "idle"
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Honeypot: only bots fill the hidden field. Pretend it worked.
    if (String(fd.get("company") ?? "")) {
      setState("sent");
      return;
    }
    setState("sending");
    const r = await submitLead({
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      service: kind === "care" ? String(fd.get("service") ?? "") : null,
      message: String(fd.get("message") ?? ""),
      kind,
    });
    if (r.ok) {
      setState("sent");
      form.reset();
    } else {
      setState(r.reason === "rate_limited" ? "limited" : "error");
    }
  }

  if (state === "sent") {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl p-6 text-plum-900">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-plum-500" aria-hidden />
        <p className="font-medium">
          Thank you — we received your message and will reach out within one
          business day. If it&apos;s urgent, please call us.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {/* honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <label className="grid gap-1.5 text-sm font-medium text-plum-900">
          Your name *
          <input
            required
            name="name"
            autoComplete="name"
            className="rounded-xl border border-plum-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-teal-500"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-plum-900">
          Phone *
          <input
            required
            name="phone"
            type="tel"
            autoComplete="tel"
            className="rounded-xl border border-plum-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-teal-500"
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-plum-900">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-xl border border-plum-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-teal-500"
        />
      </label>
      {kind === "care" && (
        <label className="grid gap-1.5 text-sm font-medium text-plum-900">
          Service you&apos;re asking about
          <select
            name="service"
            defaultValue={defaultService}
            className="rounded-xl border border-plum-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-teal-500"
          >
            {CARE_SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1.5 text-sm font-medium text-plum-900">
        {kind === "careers"
          ? "Tell us about your caregiving experience"
          : kind === "consulting"
            ? "Tell us about the agency you want to build"
            : "How can we help? (No medical details needed — just the basics)"}
        <textarea
          name="message"
          rows={4}
          className="rounded-xl border border-plum-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-teal-500"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-teal-500 px-7 py-3.5 text-base font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {state === "sending" && (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        )}
        {kind === "careers" ? "Submit application" : "Request my free assessment"}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-red-700">
          Something went wrong — please try again or call us directly.
        </p>
      )}
      {state === "limited" && (
        <p role="alert" className="text-sm font-medium text-red-700">
          We&apos;ve received several messages from you just now. Please wait a few minutes, or call us.
        </p>
      )}
      <FormPrivacyNote />
    </form>
  );
}
