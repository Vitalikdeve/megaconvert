declare module "libsodium-wrappers" {
  interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }

  interface SodiumModule {
    ready: Promise<void>;
    crypto_sign_keypair(): KeyPair;
    crypto_box_keypair(): KeyPair;
    crypto_sign_detached(
      message: Uint8Array,
      privateKey: Uint8Array
    ): Uint8Array;
    crypto_sign_verify_detached(
      signature: Uint8Array,
      message: Uint8Array,
      publicKey: Uint8Array
    ): boolean;
    crypto_scalarmult(
      secretKey: Uint8Array,
      publicKey: Uint8Array
    ): Uint8Array;
  }

  const sodium: SodiumModule;
  export default sodium;
}
