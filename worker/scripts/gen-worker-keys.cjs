const nacl = require('tweetnacl');

const bytesToB64 = (bytes) => Buffer.from(bytes).toString('base64');

const kp = nacl.box.keyPair();

console.log('WORKER_KEY_PUBLIC=' + bytesToB64(kp.publicKey));
console.log('WORKER_KEY_PRIVATE=' + bytesToB64(kp.secretKey));
