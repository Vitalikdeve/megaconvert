export interface AnonymousActor {
  id: null;
  isAuthenticated: false;
  kind: 'anonymous';
  sessionId: null;
}

export interface ServiceActor {
  id: string;
  isAuthenticated: true;
  kind: 'service';
  serviceName: string;
  sessionId: null;
}

export interface UserActor {
  id: string;
  isAuthenticated: true;
  kind: 'user';
  sessionId: string | null;
}

export type AuthenticatedActor = ServiceActor | UserActor;
export type RequestActor = AnonymousActor | AuthenticatedActor;

export const anonymousActor: AnonymousActor = {
  id: null,
  isAuthenticated: false,
  kind: 'anonymous',
  sessionId: null,
};
