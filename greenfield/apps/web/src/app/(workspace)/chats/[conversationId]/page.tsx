import { ChatFoundationPage } from '@/features/chat/chat-foundation-page';

interface ChatPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params;

  return <ChatFoundationPage conversationId={conversationId} />;
}
