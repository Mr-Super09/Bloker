import { Card } from "@shared/schema";
import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card: Card;
  className?: string;
  onClick?: () => void;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
};

export function PlayingCard({ card, className, onClick }: PlayingCardProps) {
  if (!card.faceUp) {
    return (
      <div
        className={cn(
          "playing-card face-down flex items-center justify-center cursor-pointer",
          className
        )}
        onClick={onClick}
        data-testid={`card-face-down`}
      >
        <div className="text-white text-2xl">🂠</div>
      </div>
    );
  }

  const suitSymbol = suitSymbols[card.suit];
  const suitColor = suitColors[card.suit];

  return (
    <div
      className={cn(
        "playing-card bg-white text-black flex flex-col cursor-pointer",
        className
      )}
      onClick={onClick}
      data-testid={`card-${card.value}-${card.suit}`}
    >
      <div className="p-1 text-xs">
        <div className={cn("font-bold", suitColor)}>
          {card.value}{suitSymbol}
        </div>
      </div>
      <div className={cn("flex-1 flex items-center justify-center text-2xl", suitColor)}>
        {suitSymbol}
      </div>
      <div className="p-1 text-xs transform rotate-180">
        <div className={cn("font-bold", suitColor)}>
          {card.value}{suitSymbol}
        </div>
      </div>
    </div>
  );
}
