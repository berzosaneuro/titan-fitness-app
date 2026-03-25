import { ChatClient } from "@/components/ChatClient";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Mensajes</h1>
        <p className="mt-2 text-zinc-400">Comunicación directa, cifrada en tránsito (HTTPS).</p>
      </div>
      <ChatClient />
    </div>
  );
}
