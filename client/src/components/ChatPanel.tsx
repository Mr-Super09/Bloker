import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Bot, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  gameId?: string;
  title?: string;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
}

export function ChatPanel({ 
  gameId, 
  title = "Chat", 
  placeholder = "Type a message...",
  className,
  maxHeight = "400px"
}: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: gameId ? ['/api/games', gameId, 'chat'] : ['/api/chat/global'],
    refetchInterval: 2000, // Poll every 2 seconds
    enabled: !!gameId, // Only fetch if gameId is provided
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const endpoint = gameId 
        ? `/api/games/${gameId}/chat` 
        : '/api/chat/global';
      await apiRequest('POST', endpoint, { message: messageText });
    },
    onSuccess: () => {
      setMessage("");
      const queryKey = gameId 
        ? ['/api/games', gameId, 'chat'] 
        : ['/api/chat/global'];
      queryClient.invalidateQueries({ queryKey });
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
    <Card className={cn("bg-card/50 backdrop-blur-xl border border-border card-glow", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <MessageCircle className="text-secondary mr-2" size={20} />
          {title}
          {messages.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {messages.length} messages
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col">
        {/* Chat Messages */}
        <ScrollArea className="px-4" style={{ height: maxHeight }}>
          <div className="space-y-3 pb-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-pulse">Loading messages...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="mx-auto mb-2 opacity-50" size={32} />
                <p>No messages yet.</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg: any, index: number) => (
                <div 
                  key={msg.id || index}
                  className={cn(
                    "flex space-x-3 p-2 rounded-lg transition-colors",
                    msg.isSystemMessage && "bg-muted/20"
                  )}
                  data-testid={`chat-message-${index}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    {msg.isSystemMessage ? (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Bot className="text-muted-foreground" size={14} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                        {msg.user?.profileImageUrl ? (
                          <img 
                            src={msg.user.profileImageUrl} 
                            alt={msg.user.firstName} 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="text-white" size={14} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium truncate" data-testid={`message-username-${index}`}>
                        {msg.isSystemMessage ? 'System' : (msg.user?.firstName || 'Anonymous')}
                      </span>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock size={10} className="mr-1" />
                        <span data-testid={`message-time-${index}`}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div 
                      className={cn(
                        "text-sm break-words",
                        msg.isSystemMessage ? 'text-muted-foreground italic' : 'text-foreground'
                      )}
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
        </ScrollArea>
        
        {/* Chat Input */}
        <div className="p-4 border-t border-border">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input 
              type="text"
              placeholder={placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendMessageMutation.isPending}
              className="flex-1 bg-input/50"
              data-testid="input-chat-message"
            />
            <Button 
              type="submit"
              disabled={sendMessageMutation.isPending || !message.trim()}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 shine-effect relative overflow-hidden"
              data-testid="button-send-message"
            >
              <Send size={16} />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
