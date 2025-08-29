import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { OnlinePlayersList } from "@/components/OnlinePlayersList";
import { ChallengesList } from "@/components/ChallengesList";
import { GameTable } from "@/components/GameTable";
import { GameChat } from "@/components/GameChat";
import { Spade, LogOut, Coins, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Home() {
  const { user = {}, isLoading: authLoading } = useAuth() as { user: any, isLoading: boolean };
  const { toast } = useToast();

  const { data: activeGame } = useQuery({
    queryKey: ['/api/games/active'],
    refetchInterval: 2000, // Check every 2 seconds for faster detection
  }) as { data: any };
  
  // Auto-redirect to active game if one exists
  useEffect(() => {
    if (activeGame && activeGame.id) {
      console.log('Active game detected, redirecting to game:', activeGame.id);
      window.location.href = `/game/${activeGame.id}`;
    }
  }, [activeGame]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/users/offline', {});
    },
    onSuccess: () => {
      window.location.href = '/api/logout';
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      // If offline request fails, still redirect to logout
      window.location.href = '/api/logout';
    },
  });

  // Handle page unload to set user offline
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Try to mark user as offline when leaving the page
      try {
        // Use fetch with keepalive for better reliability than sendBeacon
        fetch('/api/users/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          keepalive: true // Ensures request continues even if page unloads
        }).catch(() => {
          // Fallback to sendBeacon if fetch fails
          navigator.sendBeacon('/api/users/offline', JSON.stringify({}));
        });
      } catch {
        // Final fallback
        navigator.sendBeacon('/api/users/offline', JSON.stringify({}));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleBeforeUnload);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Spade className="text-white" size={32} />
          </div>
          <p className="text-muted-foreground">Loading...</p>
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent logo-glow">
              <Spade className="inline mr-2" size={32} />
              BLOKER
            </h1>
            <span className="text-sm text-muted-foreground">Blackjack × Poker Hybrid</span>
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
                <div className="text-muted-foreground flex items-center">
                  <Coins className="text-accent mr-1" size={12} />
                  <span data-testid="user-credits">{user?.credits || 0}</span>
                </div>
              </div>
            </div>
            <Button 
              variant="destructive"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="mr-2" size={16} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-120px)]">
          
          {/* Left Sidebar: Online Players & Challenges */}
          <div className="lg:col-span-1 space-y-6">
            <OnlinePlayersList />
            <ChallengesList />
          </div>

          {/* Main Game Area */}
          <div className="lg:col-span-2">
            {activeGame ? (
              <GameTable gameId={activeGame.id} />
            ) : (
              <div className="bg-card backdrop-blur-xl border border-border rounded-xl game-table h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6 animate-float card-glow">
                    <Spade className="text-white" size={48} />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Ready to Play Bloker?</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Challenge another player to start a game, or wait for someone to challenge you!
                  </p>
                  <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-primary rounded-full mr-2 pulse-ring"></div>
                      Waiting for challenge
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Chat & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {activeGame ? (
              <GameChat gameId={activeGame.id} />
            ) : (
              <div className="bg-card backdrop-blur-xl border border-border rounded-lg h-2/3 flex items-center justify-center card-glow">
                <div className="text-center text-muted-foreground">
                  <p>Join a game to start chatting</p>
                </div>
              </div>
            )}

            {/* Game Statistics */}
            <div className="bg-card backdrop-blur-xl border border-border rounded-lg p-6 card-glow h-1/3">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="text-accent mr-2" size={20} />
                Your Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Games Played</span>
                  <span className="font-semibold" data-testid="stats-games-played">
                    {(user?.wins || 0) + (user?.losses || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className="font-semibold text-green-400" data-testid="stats-win-rate">
                    {(user?.wins || 0) + (user?.losses || 0) > 0 
                      ? Math.round(((user?.wins || 0) / ((user?.wins || 0) + (user?.losses || 0))) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Winnings</span>
                  <span className="font-semibold text-accent" data-testid="stats-total-winnings">
                    ${user?.totalWinnings || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Credits</span>
                  <span className="font-semibold" data-testid="stats-credits">
                    ${user?.credits || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
