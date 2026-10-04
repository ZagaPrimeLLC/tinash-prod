import PageHeader from '@/components/crm/PageHeader';
import ProfileForm from '@/components/crm/ProfileForm';
import { getSession } from '@/lib/crm/session';
import { ROLE_LABELS } from '@/lib/crm/nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const { user, email, profile, role } = await getSession();

  return (
    <>
      <PageHeader
        title="My profile"
        lead="Your name, title and photo are what the rest of the team sees across the CRM instead of your email address."
      />
      <div className="p-5 sm:p-8">
        <ProfileForm
          userId={user?.id ?? ''}
          email={email}
          roleLabel={role ? ROLE_LABELS[role] : 'No role'}
          initial={profile ?? { display_name: null, avatar_url: null, job_title: null }}
        />
      </div>
    </>
  );
}
