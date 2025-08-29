import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface GameChatProps {
  gameId: string;
}

export function GameChat({ gameId }: GameChatProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/games', gameId, 'chat'],
    refetchInterval: 2000, // Poll every 2 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      await apiRequest('POST', `/api/games/${gameId}/chat`, { message: messageText });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId, 'chat'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-lg h-2/3 flex flex-col card-glow">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold flex items-center">
          <MessageCircle className="text-secondary mr-2" size={20} />
          Game Chat
        </h3>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg: any, index: number) => (
            <div 
              key={msg.id || index}
              className="flex space-x-3"
              data-testid={`chat-message-${index}`}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                {msg.isSystemMessage ? (
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                    <Bot className="text-muted-foreground" size={12} />
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                    {msg.user?.profileImageUrl ? (
                      <img 
                        src={msg.user.profileImageUrl} 
                        alt={msg.user.firstName} 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="text-white" size={12} />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium" data-testid={`message-username-${index}`}>
                    {msg.isSystemMessage ? 'System' : (msg.user?.firstName || 'Anonymous')}
                  </span>
                  <span className="text-xs text-muted-foreground" data-testid={`message-time-${index}`}>
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div 
                  className={`text-sm ${msg.isSystemMessage ? 'text-muted-foreground italic' : ''}`}
                  data-testid={`message-content-${index}`}
                >
                  {msg.message}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input 
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sendMessageMutation.isPending}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button 
            type="submit"
            disabled={sendMessageMutation.isPending || !message.trim()}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2"
            data-testid="button-send-message"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
