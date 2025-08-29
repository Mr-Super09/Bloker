import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { PlayingCard } from "./PlayingCard";
import { Card, type Game } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Spade, TrendingUp, TrendingDown, Flag } from "lucide-react";

interface GameTableProps {
  gameId: string;
}

function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  
  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

export function GameTable({ gameId }: GameTableProps) {
  const [betAmount, setBetAmount] = useState(50);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['/api/auth/user'] });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/games/${gameId}/leave`, {});
    },
    onSuccess: () => {
      toast({
        title: "Left Game",
        description: "You have left the game",
      });
      // Redirect to home page
      window.location.href = '/';
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: game, isLoading } = useQuery<any>({
    queryKey: ['/api/games', gameId],
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });

  const betMutation = useMutation({
    mutationFn: async ({ action, amount }: { action: string; amount?: number }) => {
      await apiRequest('POST', `/api/games/${gameId}/bet`, { action, amount });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
      toast({
        title: "Action Completed",
        description: `You ${variables.action}${variables.amount ? ` $${variables.amount}` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/games/${gameId}/hit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
      toast({
        title: "Card Drawn",
        description: "You drew a new card",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stayMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/games/${gameId}/stay`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
      toast({
        title: "Stayed",
        description: "You chose to stay",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card backdrop-blur-xl border border-border rounded-xl game-table h-full flex items-center justify-center">
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
      <div className="bg-card backdrop-blur-xl border border-border rounded-xl game-table h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Game not found</p>
        </div>
      </div>
    );
  }

  const player1Hand: Card[] = (() => {
    try {
      if (typeof game.player1Hand === 'string') {
        return JSON.parse(game.player1Hand);
      }
      return Array.isArray(game.player1Hand) ? game.player1Hand : [];
    } catch (e) {
      return [];
    }
  })();
  
  const player2Hand: Card[] = (() => {
    try {
      if (typeof game.player2Hand === 'string') {
        return JSON.parse(game.player2Hand);
      }
      return Array.isArray(game.player2Hand) ? game.player2Hand : [];
    } catch (e) {
      return [];
    }
  })();
  // Parse player card stacks
  const player1Cards: Card[] = (() => {
    try {
      if (typeof game.player1Cards === 'string') {
        return JSON.parse(game.player1Cards);
      }
      return Array.isArray(game.player1Cards) ? game.player1Cards : [];
    } catch (e) {
      return [];
    }
  })();
  
  const player2Cards: Card[] = (() => {
    try {
      if (typeof game.player2Cards === 'string') {
        return JSON.parse(game.player2Cards);
      }
      return Array.isArray(game.player2Cards) ? game.player2Cards : [];
    } catch (e) {
      return [];
    }
  })();
  
  const player1Value = calculateHandValue(player1Hand.filter(c => c.faceUp));
  const player2Value = calculateHandValue(player2Hand.filter(c => c.faceUp));

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-xl game-table min-h-[600px] max-h-screen flex flex-col overflow-hidden">
      {/* Compact Game Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold" data-testid="game-title">Game Table</h2>
            <div className="flex items-center space-x-2 bg-primary/10 px-2 py-1 rounded">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-ring"></div>
              <span className="text-xs text-primary font-medium">Live</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Pot</div>
              <div className="text-sm font-bold text-accent" data-testid="pot-amount">
                ${game.pot || 0}
              </div>
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              data-testid="button-leave-game"
            >
              <Flag className="mr-1" size={14} />
              {leaveMutation.isPending ? 'Leaving...' : 'Leave'}
            </Button>
          </div>
        </div>
      </div>

      {/* Compact Game Board - Stacked Layout */}
      <div className="flex-1 p-4 flex flex-col justify-between min-h-0">
        {/* Opponent Area - Compact */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center space-x-2 bg-muted/20 px-3 py-1.5 rounded mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {(game.player2 as any)?.firstName?.[0] || 'P'}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold" data-testid="opponent-name">
                {((currentUser as any)?.id === game.player1Id ? (game.player2 as any)?.firstName : (game.player1 as any)?.firstName) || 'Opponent'}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Value: <span className="text-foreground font-semibold" data-testid="opponent-hand-value">
                {player2Value}{player2Hand.some(c => !c.faceUp) ? '+?' : ''}
              </span>
            </div>
          </div>
          
          {/* Opponent Card Stack */}
          <div className="flex items-center justify-center space-x-4 mb-2">
            <div className="text-center">
              <div className="w-12 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {((currentUser as any)?.id === game.player1Id ? player2Cards.length : player1Cards.length)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Cards Left</div>
            </div>
            
            {/* Opponent Cards - Smaller */}
            <div className="flex justify-center space-x-2">
              {player2Hand.map((card, index) => (
                <div key={index} className="scale-75">
                  <PlayingCard 
                    card={card} 
                    data-testid={`opponent-card-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Area: Betting & Actions - Compact */}
        <div className="text-center py-4">
          {/* Pot and Chips - Compact */}
          <div className="flex justify-center space-x-2 mb-3">
            {(game.pot as number) > 0 && (
              <>
                <div className="chip text-xs">$50</div>
                <div className="chip text-xs">$100</div>
                <div className="chip text-xs">$250</div>
              </>
            )}
          </div>
          
          {/* Current Phase */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
            <div className="text-xs text-muted-foreground mb-1">Current Phase</div>
            <div className="text-sm font-bold text-primary capitalize" data-testid="game-phase">
              {(game.state as string)?.replace('_', ' ') || 'Loading...'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(game.state as string) === 'betting' ? 'Poker betting round' : 
               (game.state as string) === 'hitting_staying' ? 'Blackjack phase - Hit or Stay' : 
               (game.state as string) === 'setting_up' ? 'Voting on game settings' : 'Wait for action'}
            </div>
          </div>

          {/* Action Buttons - Compact */}
          {(game.state as string) === 'betting' ? (
            <div className="flex justify-center space-x-2">
              <Button 
                onClick={() => betMutation.mutate({ action: 'raise', amount: betAmount })}
                disabled={betMutation.isPending}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 shine-effect"
                data-testid="button-raise"
                size="sm"
              >
                <TrendingUp className="mr-1" size={14} />
                Raise ${betAmount}
              </Button>
              <Button 
                onClick={() => betMutation.mutate({ action: 'match' })}
                disabled={betMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 shine-effect"
                data-testid="button-match"
                size="sm"
              >
                <TrendingDown className="mr-1" size={14} />
                Match
              </Button>
              <Button 
                onClick={() => betMutation.mutate({ action: 'fold' })}
                disabled={betMutation.isPending}
                variant="destructive"
                className="px-4 py-2"
                data-testid="button-fold"
                size="sm"
              >
                <Flag className="mr-1" size={14} />
                Fold
              </Button>
            </div>
          ) : (game.state as string) === 'hitting_staying' ? (
            <div className="flex justify-center space-x-2">
              <Button 
                onClick={() => hitMutation.mutate()}
                disabled={hitMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 shine-effect"
                data-testid="button-hit"
                size="sm"
              >
                <TrendingUp className="mr-1" size={14} />
                Hit
              </Button>
              <Button 
                onClick={() => stayMutation.mutate()}
                disabled={stayMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 shine-effect"
                data-testid="button-stay"
                size="sm"
              >
                <TrendingDown className="mr-1" size={14} />
                Stay
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {(game.state as string) === 'finished' ? 'Game Over' : 'Waiting...'}
            </div>
          )}
        </div>

        {/* Player Area - Compact */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-muted/20 px-3 py-1.5 rounded mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {(game.player1 as any)?.firstName?.[0] || 'Y'}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold" data-testid="player-name">
                You ({((currentUser as any)?.id === game.player1Id ? (game.player1 as any)?.firstName : (game.player2 as any)?.firstName) || 'Player'})
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Value: <span className="text-foreground font-semibold" data-testid="player-hand-value">
                {calculateHandValue(player1Hand)}
              </span>
            </div>
          </div>
          
          {/* Player Card Stack and Hand */}
          <div className="flex items-center justify-center space-x-4">
            {/* Player Cards - Smaller */}
            <div className="flex justify-center space-x-2">
              {player1Hand.map((card, index) => (
                <div key={index} className="scale-75">
                  <PlayingCard 
                    card={card}
                    data-testid={`player-card-${index}`}
                  />
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <div className="w-12 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-lg border-2 border-green-400 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {((currentUser as any)?.id === game.player1Id ? player1Cards.length : player2Cards.length)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Your Cards</div>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Controls - Compact */}
      {(game.state as string) === 'betting' && (
        <div className="p-4 border-t border-border bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium">Bet Amount:</label>
              <input 
                type="range" 
                min="10" 
                max="500" 
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value))}
                className="flex-1 max-w-40 accent-primary"
                data-testid="input-bet-amount"
              />
              <span className="text-lg font-bold text-accent" data-testid="text-bet-amount">
                ${betAmount}
              </span>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBetAmount(10)}
                data-testid="button-min-bet"
              >
                Min
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBetAmount(Math.floor(betAmount / 2))}
                data-testid="button-half-bet"
              >
                Half
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBetAmount(500)}
                data-testid="button-max-bet"
              >
                Max
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
