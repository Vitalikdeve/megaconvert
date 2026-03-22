"use client";

import { API_URL } from "@/config/api";
import {
  HttpRequestError,
  requestJson
} from "@/shared/infrastructure/http-client";

import type { SendRemoteMessageInput } from "../domain/remote-chat.types";

export const sendRemoteMessage = ({
  chatId,
  text,
  token
}: SendRemoteMessageInput) =>
  requestJson<unknown>({
    url: `${API_URL}/messages`,
    method: "POST",
    body: {
      chatId,
      text
    },
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  }).then((payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      throw new HttpRequestError(payload.error, 200, payload);
    }

    return payload;
  });
