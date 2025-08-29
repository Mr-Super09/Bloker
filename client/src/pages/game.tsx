import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { GameTable } from "@/components/GameTable";
import { GameChat } from "@/components/GameChat";
import { Button } from "@/components/ui/button";
import { Spade, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: game, isLoading: gameLoading, error } = useQuery({
    queryKey: ['/api/games', gameId],
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
    enabled: !!gameId && isAuthenticated,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle errors
  useEffect(() => {
    if (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to load game. Returning to lobby.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    }
  }, [error, toast, setLocation]);

  // Check if user is part of this game
  useEffect(() => {
    if (game && user && game.player1Id !== user.id && game.player2Id !== user.id) {
      toast({
        title: "Access Denied",
        description: "You are not a participant in this game.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [game, user, toast, setLocation]);

  if (authLoading || gameLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Spade className="text-white" size={32} />
          </div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-destructive to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Spade className="text-white" size={32} />
          </div>
          <h2 className="text-xl font-bold mb-4">Game Not Found</h2>
          <p className="text-muted-foreground mb-6">This game doesn't exist or has been deleted.</p>
          <Button onClick={() => setLocation("/")} data-testid="button-back-to-lobby">
            <ArrowLeft className="mr-2" size={16} />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border backdrop-blur-xl bg-card/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back-to-lobby"
            >
              <ArrowLeft className="mr-2" size={16} />
              Back to Lobby
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent logo-glow">
              <Spade className="inline mr-2" size={24} />
              BLOKER
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* User Profile */}
            <div className="flex items-center space-x-3 bg-card/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt={user.firstName} 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-semibold">
                    {user?.firstName?.[0] || 'U'}
                  </span>
                )}
              </div>
              <div className="text-sm">
                <div className="font-semibold" data-testid="user-name">
                  {user?.firstName || 'Player'}
                </div>
                <div className="text-muted-foreground">
                  Game ID: {gameId?.slice(0, 8)}...
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            <GameTable gameId={gameId!} />
          </div>

          {/* Right Sidebar: Chat */}
          <div className="lg:col-span-1">
            <GameChat gameId={gameId!} />
          </div>
        </div>
      </div>
    </div>
  );
}
