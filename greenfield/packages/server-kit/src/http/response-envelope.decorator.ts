import { SetMetadata } from '@nestjs/common';

export const RESPONSE_ENVELOPE_METADATA_KEY = 'megaconvert:response-envelope';

export function UseResponseEnvelope(): MethodDecorator & ClassDecorator {
  return SetMetadata(RESPONSE_ENVELOPE_METADATA_KEY, true);
}
