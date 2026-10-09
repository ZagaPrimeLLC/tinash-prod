import PageHeader from '@/components/crm/PageHeader';
import PhoneTabs from '@/components/crm/PhoneTabs';

export default function PhoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Phone Assistant"
        lead="The assistant that answers the office line when nobody can. Every call it takes is logged here, and real calls become leads in the inbox."
      />
      <PhoneTabs />
      {children}
    </>
  );
}
