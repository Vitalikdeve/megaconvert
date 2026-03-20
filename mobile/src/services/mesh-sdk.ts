import { Platform } from 'react-native';

type BridgefyConnectEvent = {
  userId?: string;
};

type BridgefyDisconnectEvent = {
  userId?: string;
};

type BridgefyPeersEvent = {
  peers?: string[];
};

type BridgefyReceiveDataEvent = {
  data?: string;
};

type BridgefySubscription = {
  remove?: () => void;
};

type BridgefyLikeModule = {
  initialize: (apiKey: string, verboseLogging?: boolean, operationMode?: string) => Promise<void>;
  start: (userId?: string, propagationProfile?: string) => Promise<void>;
  stop: () => Promise<void>;
  sendMesh?: (data: string, recipientId: string) => Promise<string>;
  sendP2P?: (data: string, recipientId: string) => Promise<string>;
  onConnect?: (listener: (event: BridgefyConnectEvent) => void) => BridgefySubscription;
  onDisconnect?: (listener: (event: BridgefyDisconnectEvent) => void) => BridgefySubscription;
  onConnectedPeers?: (listener: (event: BridgefyPeersEvent) => void) => BridgefySubscription;
  onReceiveData?: (listener: (event: BridgefyReceiveDataEvent) => void) => BridgefySubscription;
};

type BridgefyImport = {
  default?: BridgefyLikeModule;
  BridgefyOperationMode?: {
    FOREGROUND?: string;
  };
  BridgefyPropagationProfile?: {
    REALTIME?: string;
  };
};

type MeshMessageEnvelope = {
  senderId?: string;
  payload?: string;
  createdAt?: string;
};

let bridgefyModule: BridgefyLikeModule | null = null;
let bridgefyEnums: BridgefyImport | null = null;
let importAttempted = false;
let isInitialized = false;
let isRadarRunning = false;
let activeUserId: string | null = null;
let internalSubscriptions: BridgefySubscription[] = [];

const nearbyPeers = new Set<string>();
const deviceFoundListeners = new Set<(deviceUserId: string) => void>();
const messageListeners = new Set<(senderId: string, data: string) => void>();

function normalizeMeshUserId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function loadBridgefyModule(): BridgefyLikeModule | null {
  if (importAttempted) {
    return bridgefyModule;
  }

  importAttempted = true;
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const imported = require('bridgefy-react-native') as BridgefyImport;
    bridgefyEnums = imported;
    bridgefyModule = (imported.default || imported) as BridgefyLikeModule;
  } catch (error) {
    console.error('[mesh-sdk] bridgefy-react-native module is not available in this build.', error);
    bridgefyModule = null;
  }

  return bridgefyModule;
}

function notifyDeviceFound(deviceUserId: string) {
  deviceFoundListeners.forEach((listener) => {
    listener(deviceUserId);
  });
}

function notifyMessageReceived(senderId: string, data: string) {
  messageListeners.forEach((listener) => {
    listener(senderId, data);
  });
}

function handleIncomingBridgefyData(rawData: string | undefined) {
  const raw = String(rawData || '').trim();
  if (!raw) {
    return;
  }

  try {
    const envelope = JSON.parse(raw) as MeshMessageEnvelope;
    const senderId = normalizeMeshUserId(envelope.senderId);
    const payload = typeof envelope.payload === 'string' ? envelope.payload : '';
    if (!senderId || !payload) {
      return;
    }

    nearbyPeers.add(senderId);
    notifyDeviceFound(senderId);
    notifyMessageReceived(senderId, payload);
  } catch {
    // ignore malformed payload
  }
}

function attachInternalListeners(bridgefy: BridgefyLikeModule) {
  if (internalSubscriptions.length > 0) {
    return;
  }

  const connectSubscription = bridgefy.onConnect?.((event) => {
    const userId = normalizeMeshUserId(event?.userId);
    if (!userId) {
      return;
    }
    nearbyPeers.add(userId);
    notifyDeviceFound(userId);
  });

  const peersSubscription = bridgefy.onConnectedPeers?.((event) => {
    const peers = event?.peers || [];
    peers.forEach((peerId) => {
      const normalizedPeer = normalizeMeshUserId(peerId);
      if (!normalizedPeer) {
        return;
      }
      nearbyPeers.add(normalizedPeer);
      notifyDeviceFound(normalizedPeer);
    });
  });

  const disconnectSubscription = bridgefy.onDisconnect?.((event) => {
    const userId = normalizeMeshUserId(event?.userId);
    if (!userId) {
      return;
    }
    nearbyPeers.delete(userId);
  });

  const receiveDataSubscription = bridgefy.onReceiveData?.((event) => {
    handleIncomingBridgefyData(event?.data);
  });

  internalSubscriptions = [
    connectSubscription,
    peersSubscription,
    disconnectSubscription,
    receiveDataSubscription,
  ].filter(Boolean) as BridgefySubscription[];
}

async function ensureInitialized(apiKey: string): Promise<boolean> {
  const bridgefy = loadBridgefyModule();
  if (!bridgefy) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    const operationMode = bridgefyEnums?.BridgefyOperationMode?.FOREGROUND;
    await bridgefy.initialize(apiKey, false, operationMode);
    attachInternalListeners(bridgefy);
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[mesh-sdk] initialize failed', error);
    return false;
  }
}

async function startRadar(): Promise<boolean> {
  const bridgefy = loadBridgefyModule();
  if (!bridgefy || !activeUserId) {
    return false;
  }

  if (isRadarRunning) {
    return true;
  }

  try {
    const profile = bridgefyEnums?.BridgefyPropagationProfile?.REALTIME;
    await bridgefy.start(activeUserId, profile);
    isRadarRunning = true;
    return true;
  } catch (error) {
    console.error('[mesh-sdk] start failed', error);
    return false;
  }
}

async function stopRadar(): Promise<boolean> {
  const bridgefy = loadBridgefyModule();
  if (!bridgefy) {
    return false;
  }

  if (!isRadarRunning) {
    return true;
  }

  try {
    await bridgefy.stop();
    isRadarRunning = false;
    return true;
  } catch (error) {
    console.error('[mesh-sdk] stop failed', error);
    return false;
  }
}

async function init(apiKey: string, userId: string): Promise<boolean> {
  const normalizedUserId = normalizeMeshUserId(userId);
  if (!normalizedUserId) {
    return false;
  }

  activeUserId = normalizedUserId;
  return ensureInitialized(apiKey);
}

async function startScanning(): Promise<boolean> {
  return startRadar();
}

async function startAdvertising(): Promise<boolean> {
  return startRadar();
}

async function stopScanning(): Promise<boolean> {
  return stopRadar();
}

async function stopAdvertising(): Promise<boolean> {
  return stopRadar();
}

async function sendMessage(targetUserId: string, data: string): Promise<boolean> {
  const bridgefy = loadBridgefyModule();
  if (!bridgefy || !activeUserId) {
    return false;
  }

  const normalizedTarget = normalizeMeshUserId(targetUserId);
  if (!normalizedTarget || !data) {
    return false;
  }

  if (!isRadarRunning) {
    const started = await startRadar();
    if (!started) {
      return false;
    }
  }

  const envelope: MeshMessageEnvelope = {
    senderId: activeUserId,
    payload: data,
    createdAt: new Date().toISOString(),
  };

  try {
    if (typeof bridgefy.sendMesh === 'function') {
      await bridgefy.sendMesh(JSON.stringify(envelope), normalizedTarget);
    } else if (typeof bridgefy.sendP2P === 'function') {
      await bridgefy.sendP2P(JSON.stringify(envelope), normalizedTarget);
    } else {
      return false;
    }

    nearbyPeers.add(normalizedTarget);
    notifyDeviceFound(normalizedTarget);
    return true;
  } catch (error) {
    console.error('[mesh-sdk] sendMessage failed', error);
    return false;
  }
}

function isPeerNearby(targetUserId: string): boolean {
  const normalizedTarget = normalizeMeshUserId(targetUserId);
  if (!normalizedTarget) {
    return false;
  }
  return nearbyPeers.has(normalizedTarget);
}

function onDeviceFound(listener: (deviceUserId: string) => void): () => void {
  deviceFoundListeners.add(listener);
  if (nearbyPeers.size > 0) {
    nearbyPeers.forEach((peerId) => {
      listener(peerId);
    });
  }

  return () => {
    deviceFoundListeners.delete(listener);
  };
}

function onMessageReceived(listener: (senderId: string, data: string) => void): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

const MeshSDK = {
  init,
  startScanning,
  startAdvertising,
  stopScanning,
  stopAdvertising,
  sendMessage,
  isPeerNearby,
  onDeviceFound,
  onMessageReceived,
};

export default MeshSDK;
