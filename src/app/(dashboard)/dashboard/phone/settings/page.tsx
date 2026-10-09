import PhoneSettingsForm from '@/components/crm/PhoneSettingsForm';
import { PhoneLoadError } from '@/components/crm/PhoneParts';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import type { PhoneSettings } from '@/lib/crm/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phone Assistant settings' };

export default async function PhoneSettingsPage() {
  const { supabase, role } = await getSession();
  const { data, error } = await supabase.from('phone_settings').select('*').eq('id', 1).maybeSingle();

  if (error || !data) {
    return (
      <div className="p-5 sm:p-8">
        <PhoneLoadError message={error?.message ?? 'The settings row is missing. Re-run the phone assistant migration.'} />
      </div>
    );
  }

  const settings = data as PhoneSettings;
  const { data: who } = settings.updated_by
    ? await supabase.from('profiles').select('display_name').eq('id', settings.updated_by).maybeSingle()
    : { data: null };

  return (
    <PhoneSettingsForm
      // A fresh form after every save, so the fields show what the database kept.
      key={settings.updated_at}
      settings={settings}
      canWrite={canWrite(role)}
      updatedBy={who?.display_name ?? (settings.updated_by ? 'a team member' : null)}
    />
  );
}
