'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveProfile } from '@/app/(dashboard)/dashboard/profile/actions';
import Avatar from '@/components/crm/Avatar';
import type { Profile } from '@/lib/crm/session';

const SIZE = 256;

/** Centre-crops to a square and scales to 256px, so a phone photo uploads in a moment. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare the photo.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', 0.88)
  );
}

export default function ProfileForm({
  userId, email, roleLabel, initial,
}: { userId: string; email: string; roleLabel: string; initial: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.display_name ?? '');
  const [title, setTitle] = useState(initial.job_title ?? '');
  const [avatar, setAvatar] = useState(initial.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith('image/')) {
      setMsg({ text: 'Choose a photo (JPG, PNG or WebP).', ok: false });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMsg({ text: 'That photo is over 15MB. Choose a smaller one.', ok: false });
      return;
    }
    setUploading(true);
    try {
      const blob = await squareJpeg(file);
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from('tinash-avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (error) throw error;
      const { data } = supabase.storage.from('tinash-avatars').getPublicUrl(path);
      // The file name never changes, so a version stops browsers showing the old photo.
      setAvatar(`${data.publicUrl}?v=${Date.now()}`);
      setMsg({ text: 'Photo ready. Save to keep it.', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'The photo could not be uploaded.', ok: false });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePhoto() {
    setMsg(null);
    await createClient().storage.from('tinash-avatars').remove([`${userId}/avatar.jpg`]);
    setAvatar('');
    setMsg({ text: 'Photo removed. Save to confirm.', ok: true });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('display_name', name);
    fd.set('job_title', title);
    fd.set('avatar_url', avatar);
    setMsg(null);
    start(async () => {
      const r = await saveProfile(fd);
      setMsg(r.ok ? { text: r.note, ok: true } : { text: r.error, ok: false });
      if (r.ok) router.refresh();
    });
  }

  const field = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-plum-700 focus:outline-none focus:ring-1 focus:ring-plum-700';

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center">
        <div className="relative">
          <Avatar name={name} email={email} url={avatar} size={112} />
          {uploading && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-plum-700" />
            </span>
          )}
        </div>
        <p className="mt-3 font-bold text-plum-950">{name || email}</p>
        <p className="text-xs text-slate-500">{title || roleLabel}</p>

        <input ref={fileRef} id="p-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <label htmlFor="p-photo"
          className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50">
          <Camera className="h-4 w-4" /> {avatar ? 'Change photo' : 'Add a photo'}
        </label>
        {avatar && (
          <button type="button" onClick={removePhoto}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline">
            <Trash2 className="h-3.5 w-3.5" /> Remove photo
          </button>
        )}
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="p-name" className="block text-sm font-semibold text-slate-800">Display name</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            placeholder="e.g. Kelvin Zee" autoComplete="name" className={field} />
          <p className="mt-1 text-xs text-slate-500">Shown to the team instead of your email address.</p>
        </div>
        <div>
          <label htmlFor="p-title" className="block text-sm font-semibold text-slate-800">Job title</label>
          <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="e.g. Operations Manager" className={field} />
        </div>
        <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-slate-500">Sign-in email</dt>
            <dd className="truncate text-slate-800">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Access</dt>
            <dd className="text-slate-800">{roleLabel} <span className="text-xs text-slate-500">(set by an administrator)</span></dd>
          </div>
        </dl>

        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>
        )}

        <button type="submit" disabled={pending || uploading}
          className="rounded-lg bg-plum-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60">
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
