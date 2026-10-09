'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Loader2, Play, Square, Power, FlaskConical, AudioLines, MessageSquareQuote, Sparkles, BookOpen, Clock, AlertTriangle,
} from 'lucide-react';
import { Card, CardHead } from '@/components/crm/ui';
import { savePhoneSettings } from '@/app/(dashboard)/dashboard/phone/actions';
import { VOICES, LIMITS, type PhoneSettings } from '@/lib/crm/phone';

function Banner({ msg, tone }: { msg: string; tone: 'ok' | 'bad' }) {
  return (
    <p
      role={tone === 'bad' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ${
        tone === 'bad' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      }`}
    >
      {msg}
    </p>
  );
}

/** A switch that posts as a normal checkbox ("on" when set). */
function Toggle({
  name, checked, onChange, disabled, label,
}: { name: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string }) {
  return (
    <label className={`relative inline-flex shrink-0 items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-plum-400" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

export default function PhoneSettingsForm({
  settings, canWrite, updatedBy,
}: { settings: PhoneSettings; canWrite: boolean; updatedBy: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [testMode, setTestMode] = useState(settings.test_mode);
  const [voice, setVoice] = useState(settings.voice);
  const [speed, setSpeed] = useState(Number(settings.voice_speed));
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ro = !canWrite;

  function play(key: string, src: string) {
    audio.current?.pause();
    if (playing === key) { setPlaying(null); return; }
    const a = new Audio(src);
    a.playbackRate = speed;
    a.onended = () => setPlaying(null);
    audio.current = a;
    setPlaying(key);
    a.play().catch(() => setPlaying(null));
  }

  function submit(fd: FormData) {
    // A turned-off toggle sends nothing, which the action reads as off.
    if (testMode !== settings.test_mode && !testMode
        && !confirm('Turn test mode off? Real calls will create inbox leads and email the office.')) {
      return;
    }
    setMsg(null);
    start(async () => {
      const r = await savePhoneSettings(fd);
      setMsg(r.ok ? { text: r.note ?? 'Saved.', tone: 'ok' } : { text: r.error, tone: 'bad' });
    });
  }

  const field = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500';
  const label = 'block text-xs font-semibold text-slate-700';
  const hint = 'mt-1.5 text-xs leading-relaxed text-slate-500';
  const updated = new Date(settings.updated_at).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <form action={submit} className="space-y-6 p-5 sm:p-8">
      {ro && (
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          This is a read only view. The operations team changes the phone assistant.
        </p>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHead title="On or off" sub="Whether the assistant answers forwarded calls" icon={Power} />
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold text-plum-950">{enabled ? 'Answering calls' : 'Not answering'}</p>
              <p className={hint}>
                Off: callers hear a short message with the office hours, asking them to call back, and
                the call ends. Use it if the assistant misbehaves; it takes effect within 30 seconds.
              </p>
            </div>
            <Toggle name="enabled" checked={enabled} onChange={setEnabled} disabled={ro} label="Answering calls" />
          </div>
        </Card>

        <Card>
          <CardHead title="Test mode" sub="Practice calls stay out of the inbox" icon={FlaskConical} />
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold text-plum-950">{testMode ? 'On: calls are only logged here' : 'Off: live'}</p>
              <p className={hint}>
                On: every call is logged on this page and nothing else happens.
              </p>
            </div>
            <Toggle name="test_mode" checked={testMode} onChange={setTestMode} disabled={ro} label="Test mode" />
          </div>
          <div className="px-5 pb-5">
            <p className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ${
              testMode ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-red-50 text-red-900 ring-red-200'
            }`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Off means real leads.</strong> Every call that gives a name and a number becomes a
                lead in the inbox and emails the office, exactly like a website form. Turn it off only
                once the assistant has been tested on the real line.
              </span>
            </p>
          </div>
        </Card>
      </section>

      <Card>
        <CardHead title="Voice" sub="Phone-quality samples, as callers hear them" icon={AudioLines} />
        <div className="space-y-5 p-5">
          <fieldset>
            <legend className={label}>Who callers hear</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {VOICES.map((v) => (
                <label
                  key={v.key}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    voice === v.key ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500' : 'border-slate-200 bg-white'
                  } ${ro ? '' : 'cursor-pointer hover:border-slate-300'}`}
                >
                  <input
                    type="radio"
                    name="voice"
                    value={v.key}
                    checked={voice === v.key}
                    onChange={() => setVoice(v.key)}
                    disabled={ro}
                    className="border-slate-300 text-teal-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-plum-950">{v.label}</span>
                    <span className="block text-xs text-slate-500">{v.note}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => play(v.key, v.sample)}
                    aria-label={playing === v.key ? `Stop ${v.label}` : `Play ${v.label}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-plum-700 text-white hover:bg-plum-800"
                  >
                    {playing === v.key ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                </label>
              ))}
            </div>
            <p className={hint}>
              The light voices start speaking sooner on the Raspberry Pi. A voice from the other
              group takes a few seconds to load before its first call.
            </p>
          </fieldset>

          <div>
            <label htmlFor="ps-speed" className={label}>
              Speaking speed <span className="font-normal text-slate-500">· {speed.toFixed(2)}×</span>
            </label>
            <input
              id="ps-speed"
              name="voice_speed"
              type="range"
              min={LIMITS.speedMin}
              max={LIMITS.speedMax}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={ro}
              className="mt-2 w-full max-w-md accent-teal-600"
            />
            <div className="flex max-w-md justify-between text-[11px] text-slate-400">
              <span>slower</span><span>normal</span><span>faster</span>
            </div>
            <p className={hint}>
              Applies to the natural voices. The samples above play at this speed. Older callers
              often do better a little slower.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="What it says" sub="The first and last words of every call" icon={MessageSquareQuote} />
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <label htmlFor="ps-greeting" className={label}>Greeting</label>
            <textarea id="ps-greeting" name="greeting" rows={4} required maxLength={LIMITS.greeting}
              defaultValue={settings.greeting ?? ''} disabled={ro} className={field} />
            <p className={hint}>
              Short and plain works best on the phone. Do not call it a person: if asked, the
              assistant says honestly that it is an automated assistant.
            </p>
          </div>
          <div>
            <label htmlFor="ps-farewell" className={label}>Goodbye</label>
            <textarea id="ps-farewell" name="farewell" rows={4} required maxLength={LIMITS.farewell}
              defaultValue={settings.farewell ?? ''} disabled={ro} className={field} />
            <p className={hint}>
              Said at the end of the call, after it tells the caller when someone will call back.
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHead title="Tone and extra instructions" sub="How it should come across" icon={Sparkles} />
          <div className="p-5">
            <label htmlFor="ps-custom" className="sr-only">Tone and extra instructions</label>
            <textarea id="ps-custom" name="custom_instructions" rows={8} maxLength={LIMITS.custom_instructions}
              defaultValue={settings.custom_instructions ?? ''} disabled={ro} className={field}
              placeholder={'e.g. Speak a little more slowly with older callers.\nIf someone asks about weekend shifts, say the office will explain the schedule.'} />
            <p className={hint}>
              Added after the built-in rules. The safety rules always win: it sends emergencies to
              911, never quotes prices, never gives medical, legal or eligibility advice, and never
              promises a start date, availability or a job.
            </p>
          </div>
        </Card>

        <Card>
          <CardHead title="Extra facts" sub="Things it may tell callers" icon={BookOpen} />
          <div className="p-5">
            <label htmlFor="ps-facts" className="sr-only">Extra facts</label>
            <textarea id="ps-facts" name="extra_facts" rows={8} maxLength={LIMITS.extra_facts}
              defaultValue={settings.extra_facts ?? ''} disabled={ro} className={field}
              placeholder={'e.g. The office is closed on Thanksgiving Day and the day after.\nWe are hiring CHHAs in Union County.'} />
            <p className={hint}>
              The assistant only states facts from its fact sheet and this box. Write each one as a
              plain sentence. Leave out prices and anything you would not want repeated to a caller.
            </p>
          </div>
        </Card>
      </section>

      <Card>
        <CardHead title="Privacy" sub="How long call transcripts are kept" icon={Clock} />
        <div className="flex flex-wrap items-end gap-4 p-5">
          <div>
            <label htmlFor="ps-retention" className={label}>Keep transcripts for</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input id="ps-retention" name="transcript_retention_days" type="number" required
                min={LIMITS.retentionMin} max={LIMITS.retentionMax}
                defaultValue={settings.transcript_retention_days} disabled={ro}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50" />
              <span className="text-sm text-slate-600">days</span>
            </div>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-slate-500">
            After this, the transcript is deleted here and on the device. The call itself, the
            summary and the details taken stay.
          </p>
        </div>
      </Card>

      {msg && <Banner msg={msg.text} tone={msg.tone} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Last changed {updated}{updatedBy ? ` by ${updatedBy}` : ''}.
        </p>
        {canWrite && (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-plum-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
          </button>
        )}
      </div>
    </form>
  );
}
