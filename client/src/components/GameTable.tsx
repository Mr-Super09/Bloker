import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { PlayingCard } from "./PlayingCard";
import { Card } from "@shared/schema";
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

  const { data: game, isLoading } = useQuery({
    queryKey: ['/api/games', gameId],
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });

  const betMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest('POST', `/api/games/${gameId}/bet`, { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
      toast({
        title: "Bet Placed",
        description: `You bet $${betAmount}`,
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

  const player1Hand: Card[] = JSON.parse(game.player1Hand || '[]');
  const player2Hand: Card[] = JSON.parse(game.player2Hand || '[]');
  const player1Value = calculateHandValue(player1Hand.filter(c => c.faceUp));
  const player2Value = calculateHandValue(player2Hand.filter(c => c.faceUp));

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-xl game-table h-full flex flex-col">
      {/* Game Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold" data-testid="game-title">Game Table</h2>
            <div className="flex items-center space-x-2 bg-primary/10 px-3 py-1 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full pulse-ring"></div>
              <span className="text-sm text-primary font-medium">Live Game</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Current Pot</div>
              <div className="text-lg font-bold text-accent" data-testid="pot-amount">
                ${game.pot}
              </div>
            </div>
            <Button variant="destructive" size="sm" data-testid="button-leave-game">
              <Flag className="mr-2" size={16} />
              Leave Game
            </Button>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        {/* Opponent Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 bg-muted/20 px-4 py-2 rounded-lg mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {game.player2?.firstName?.[0] || 'P'}
              </span>
            </div>
            <div>
              <div className="font-semibold" data-testid="opponent-name">
                {game.player2?.firstName || 'Opponent'}
              </div>
              <div className="text-xs text-muted-foreground">
                {game.state === 'betting' ? 'Betting...' : 'Playing...'}
              </div>
            </div>
          </div>
          
          {/* Opponent Cards */}
          <div className="flex justify-center space-x-3 mb-4">
            {player2Hand.map((card, index) => (
              <PlayingCard 
                key={index} 
                card={card} 
                data-testid={`opponent-card-${index}`}
              />
            ))}
          </div>
          
          {/* Opponent Stats */}
          <div className="text-sm text-muted-foreground">
            Hand Value: <span className="text-foreground font-semibold" data-testid="opponent-hand-value">
              {player2Value}{player2Hand.some(c => !c.faceUp) ? '+?' : ''}
            </span>
          </div>
        </div>

        {/* Center Area: Betting & Actions */}
        <div className="text-center py-8">
          {/* Pot and Chips */}
          <div className="flex justify-center space-x-4 mb-6">
            {game.pot > 0 && (
              <>
                <div className="chip">$50</div>
                <div className="chip">$100</div>
                <div className="chip">$250</div>
              </>
            )}
          </div>
          
          {/* Current Phase */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
            <div className="text-sm text-muted-foreground mb-1">Current Phase</div>
            <div className="text-lg font-bold text-primary capitalize" data-testid="game-phase">
              {game.state.replace('_', ' ')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {game.state === 'betting' ? 'Place your bets' : 'Hit or Stay'}
            </div>
          </div>

          {/* Action Buttons */}
          {game.state === 'betting' ? (
            <div className="flex justify-center space-x-3">
              <Button 
                onClick={() => betMutation.mutate(betAmount)}
                disabled={betMutation.isPending}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6 py-3 shine-effect"
                data-testid="button-raise"
              >
                <TrendingUp className="mr-2" size={16} />
                Raise ${betAmount}
              </Button>
              <Button 
                onClick={() => betMutation.mutate(game.player1Bet)}
                disabled={betMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 shine-effect"
                data-testid="button-match"
              >
                <TrendingDown className="mr-2" size={16} />
                Match
              </Button>
              <Button 
                variant="destructive"
                className="px-6 py-3"
                data-testid="button-fold"
              >
                <Flag className="mr-2" size={16} />
                Fold
              </Button>
            </div>
          ) : (
            <div className="flex justify-center space-x-3">
              <Button 
                onClick={() => hitMutation.mutate()}
                disabled={hitMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 shine-effect"
                data-testid="button-hit"
              >
                <TrendingUp className="mr-2" size={16} />
                Hit
              </Button>
              <Button 
                onClick={() => stayMutation.mutate()}
                disabled={stayMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 shine-effect"
                data-testid="button-stay"
              >
                <TrendingDown className="mr-2" size={16} />
                Stay
              </Button>
            </div>
          )}
        </div>

        {/* Player Area */}
        <div className="text-center">
          {/* Player Stats */}
          <div className="text-sm text-muted-foreground mb-4">
            Hand Value: <span className="text-foreground font-semibold" data-testid="player-hand-value">
              {calculateHandValue(player1Hand)}
            </span>
          </div>
          
          {/* Player Cards */}
          <div className="flex justify-center space-x-3 mb-4">
            {player1Hand.map((card, index) => (
              <PlayingCard 
                key={index} 
                card={card}
                data-testid={`player-card-${index}`}
              />
            ))}
          </div>
          
          <div className="inline-flex items-center space-x-3 bg-muted/20 px-4 py-2 rounded-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {game.player1?.firstName?.[0] || 'Y'}
              </span>
            </div>
            <div>
              <div className="font-semibold" data-testid="player-name">
                You ({game.player1?.firstName || 'Player'})
              </div>
              <div className="text-xs text-accent">Your turn</div>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Controls */}
      {game.state === 'betting' && (
        <div className="p-6 border-t border-border bg-muted/10">
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
