"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

type Kind = "care" | "consulting" | "careers";

export default function InquiryForm({
  kind = "care",
  compact = false,
}: {
  kind?: Kind;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind }),
      });
      if (!res.ok) throw new Error("failed");
      setState("sent");
      form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl p-6 text-pine-900">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-pine-500" aria-hidden />
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
        <label className="grid gap-1.5 text-sm font-medium text-pine-900">
          Your name *
          <input
            required
            name="name"
            autoComplete="name"
            className="rounded-xl border border-pine-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-gold-500"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-pine-900">
          Phone *
          <input
            required
            name="phone"
            type="tel"
            autoComplete="tel"
            className="rounded-xl border border-pine-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-gold-500"
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-pine-900">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-xl border border-pine-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-gold-500"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-pine-900">
        {kind === "careers"
          ? "Tell us about your caregiving experience"
          : kind === "consulting"
            ? "Tell us about the agency you want to build"
            : "How can we help? (No medical details needed — just the basics)"}
        <textarea
          name="message"
          rows={4}
          className="rounded-xl border border-pine-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-gold-500"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 px-7 py-3.5 text-base font-semibold text-pine-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {state === "sending" && (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        )}
        {kind === "careers" ? "Submit application" : "Request my free assessment"}
      </button>
      {state === "error" && (
        <p className="text-sm font-medium text-red-700">
          Something went wrong — please try again or call us directly.
        </p>
      )}
      <p className="text-xs leading-5 text-pine-500">
        Please don&apos;t include medical or diagnosis details in this form.
        We&apos;ll discuss care needs privately by phone.
      </p>
    </form>
  );
}
