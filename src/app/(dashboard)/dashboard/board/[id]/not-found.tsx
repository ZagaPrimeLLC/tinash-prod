import Link from 'next/link';

export default function WorkItemNotFound() {
  return <div className="p-5 sm:p-8">
    <h1 className="text-xl font-bold text-plum-950">Item not available</h1>
    <p className="mt-2 text-sm text-slate-600">This item may have been removed, or your account does not have access to it.</p>
    <Link href="/dashboard/board" className="mt-5 inline-block text-sm font-semibold text-teal-700 underline">Back to the work board</Link>
  </div>;
}
