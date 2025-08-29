import { User } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon, Crown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  player: User;
  isCurrentUser?: boolean;
  isOnline?: boolean;
  isWinner?: boolean;
  className?: string;
}

export function PlayerCard({ 
  player, 
  isCurrentUser = false, 
  isOnline = false, 
  isWinner = false,
  className 
}: PlayerCardProps) {
  const winRate = (player.wins + player.losses) > 0 
    ? Math.round((player.wins / (player.wins + player.losses)) * 100)
    : 0;

  return (
    <Card className={cn(
      "bg-card/50 backdrop-blur-xl border border-border transition-all duration-300",
      isWinner && "border-accent shadow-lg shadow-accent/25",
      isCurrentUser && "ring-2 ring-primary/50",
      "card-glow",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              {player.profileImageUrl ? (
                <img 
                  src={player.profileImageUrl} 
                  alt={player.firstName || 'Player'} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserIcon className="text-white" size={20} />
              )}
            </div>
            
            {/* Online Status */}
            {isOnline && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background pulse-ring"></div>
            )}
            
            {/* Winner Crown */}
            {isWinner && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <Crown className="text-accent-foreground" size={12} />
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-sm truncate" data-testid={`player-name-${player.id}`}>
                {player.firstName || 'Anonymous'}
              </h3>
              {isCurrentUser && (
                <Badge variant="secondary" className="text-xs">You</Badge>
              )}
              {isWinner && (
                <Badge className="text-xs bg-accent text-accent-foreground">
                  <Trophy size={10} className="mr-1" />
                  Winner
                </Badge>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex items-center space-x-3 text-xs text-muted-foreground">
              <span data-testid={`player-wins-${player.id}`}>
                W: {player.wins}
              </span>
              <span data-testid={`player-losses-${player.id}`}>
                L: {player.losses}
              </span>
              <span 
                className={cn(
                  "font-semibold",
                  winRate >= 70 ? "text-green-400" : 
                  winRate >= 50 ? "text-yellow-400" : 
                  "text-red-400"
                )}
                data-testid={`player-winrate-${player.id}`}
              >
                {winRate}%
              </span>
            </div>
            
            {/* Credits */}
            <div className="text-xs text-accent mt-1" data-testid={`player-credits-${player.id}`}>
              ${player.credits?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
