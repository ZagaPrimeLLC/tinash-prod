'use client';

import { useEffect } from 'react';
import { captureFirstTouch } from '@/lib/attribution';

/**
 * Public site only (never the CRM): records where the visitor first came from
 * (UTM tags / referrer, in their own browser, no cookie, no third party) so it
 * can be attached to whatever form they eventually send.
 */
export default function SiteTracking() {
  useEffect(() => {
    captureFirstTouch();
  }, []);
  return null;
}
