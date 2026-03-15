import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  deriveSharedSecret,
  exportPublicKey,
  generateKeyPair,
  importPublicKey,
} from '../utils/crypto.js';

const STORAGE_PRIVATE_JWK_KEY = 'mc_messenger_private_jwk';
const STORAGE_PUBLIC_JWK_KEY = 'mc_messenger_public_jwk';

const readJson = (key) => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota issues
  }
};

export default function useMessengerKeys({ apiBase, userId }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [publicJwk, setPublicJwk] = useState(null);
  const [sharedSecrets, setSharedSecrets] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;

    const bootstrapKeys = async () => {
      if (!userId) {
        setReady(true);
        return;
      }

      try {
        const subtle = window.crypto?.subtle;
        if (!subtle) {
          throw new Error('WebCrypto is not supported in this browser.');
        }

        let storedPrivate = readJson(STORAGE_PRIVATE_JWK_KEY);
        let storedPublic = readJson(STORAGE_PUBLIC_JWK_KEY);

        let importedPrivateKey = null;

        if (storedPrivate && storedPrivate.kty) {
          try {
            importedPrivateKey = await subtle.importKey(
              'jwk',
              storedPrivate,
              {
                name: 'ECDH',
                namedCurve: 'P-256',
              },
              false,
              ['deriveKey', 'deriveBits'],
            );
          } catch {
            importedPrivateKey = null;
          }
        }

        if (!importedPrivateKey) {
          const keyPair = await generateKeyPair();
          const exportedPublic = await exportPublicKey(keyPair.publicKey);
          const exportedPrivate = await subtle.exportKey('jwk', keyPair.privateKey);

          storedPrivate = exportedPrivate;
          storedPublic = exportedPublic;
          importedPrivateKey = keyPair.privateKey;

          writeJson(STORAGE_PRIVATE_JWK_KEY, exportedPrivate);
          writeJson(STORAGE_PUBLIC_JWK_KEY, exportedPublic);

          const endpoint = `${apiBase || '/api'}/messenger/keys`;
          try {
            await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
              },
              body: JSON.stringify({ publicKey: exportedPublic }),
            });
          } catch {
            // best-effort, user can retry later
          }
        }

        if (cancelled) return;

        setPrivateKey(importedPrivateKey);
        setPublicJwk(storedPublic);
        setReady(true);
      } catch (error) {
        console.error('[messenger] key bootstrap failed:', error);
        toast.error(
          t('messenger.keysInitFailed', 'Unable to initialize secure messaging keys in this browser.'),
        );
        setReady(true);
      }
    };

    void bootstrapKeys();

    return () => {
      cancelled = true;
    };
  }, [apiBase, t, userId]);

  const getOrCreateSharedSecret = useCallback(async (contactId) => {
    if (!contactId || !privateKey || !userId) {
      throw new Error('Missing user or key context.');
    }

    if (sharedSecrets.has(contactId)) {
      return sharedSecrets.get(contactId);
    }

    const endpoint = `${apiBase || '/api'}/messenger/contacts/${encodeURIComponent(
      contactId,
    )}/public-key`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });
    if (!res.ok) {
      throw new Error('Failed to load contact key.');
    }
    const payload = await res.json();
    if (!payload?.publicKey) {
      throw new Error('Contact has no public key.');
    }

    const contactPublicKey = await importPublicKey(payload.publicKey);
    const secretKey = await deriveSharedSecret(privateKey, contactPublicKey);

    setSharedSecrets((current) => {
      const next = new Map(current);
      next.set(contactId, secretKey);
      return next;
    });

    return secretKey;
  }, [apiBase, privateKey, sharedSecrets, userId]);

  return {
    ready,
    publicJwk,
    getOrCreateSharedSecret,
  };
}

