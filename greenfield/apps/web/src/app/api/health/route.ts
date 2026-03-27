import { livenessReportSchema } from '@megaconvert/contracts';
import { NextResponse } from 'next/server';


import { getWebServiceDescriptor } from '@/lib/server/service-metadata';

export function GET() {
  return NextResponse.json(
    livenessReportSchema.parse({
      service: getWebServiceDescriptor(),
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  );
}
