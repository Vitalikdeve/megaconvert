export interface SendRemoteMessageInput {
  chatId: string;
  text: string;
  token?: string;
}

export interface RemoteSocketMessagePayload {
  chatId: string;
  text: string;
  username: string;
  clientMessageId: string;
  createdAt: string;
}
