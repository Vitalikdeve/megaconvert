import net from 'node:net';

export async function findFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate a free port.'));
        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}
