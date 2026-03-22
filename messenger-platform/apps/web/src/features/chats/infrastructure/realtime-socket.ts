"use client";

import { io, type Socket } from "socket.io-client";

import { REALTIME_URL } from "@/config/api";

import type { RemoteSocketMessagePayload } from "../domain/remote-chat.types";

export const createMessengerSocket = () =>
  io(REALTIME_URL, {
    transports: ["websocket", "polling"]
  });

export const emitRemoteMessage = (
  socket: Socket,
  payload: RemoteSocketMessagePayload
) => {
  socket.emit("send_message", payload);
};
