"use client";

import { io, type Socket } from "socket.io-client";

import { REALTIME_URL } from "@/config/api";

export const createMessengerSocket = (token: string) =>
  io(REALTIME_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: {
      token
    }
  });

export type MessengerSocket = Socket;
