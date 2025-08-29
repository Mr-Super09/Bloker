import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Clock, Settings, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface GameSettingsVotingProps {
  game: any;
  currentUserId: string;
}

export function GameSettingsVoting({ game, currentUserId }: GameSettingsVotingProps) {
  const [numDecks, setNumDecks] = useState(1);
  const [allowPeek, setAllowPeek] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isPlayer1 = game.player1Id === currentUserId;
  const player1Vote = JSON.parse(game.player1SettingsVote || '{}');
  const player2Vote = JSON.parse(game.player2SettingsVote || '{}');
  const hasVoted = isPlayer1 ? !!player1Vote.numDecks : !!player2Vote.numDecks;
  const otherPlayerVoted = isPlayer1 ? !!player2Vote.numDecks : !!player1Vote.numDecks;

  const voteSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/games/${game.id}/vote-settings`, {
        numDecks,
        allowPeek,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Vote Submitted",
        description: "Waiting for the other player to vote...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/games', game.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (game.settingsVotingDeadline) {
      const updateTimeLeft = () => {
        const deadline = new Date(game.settingsVotingDeadline);
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeLeft("Voting expired");
        } else {
          setTimeLeft(formatDistanceToNow(deadline, { addSuffix: true }));
        }
      };

      updateTimeLeft();
      const interval = setInterval(updateTimeLeft, 1000);
      return () => clearInterval(interval);
    }
  }, [game.settingsVotingDeadline]);

  const handleSubmitVote = () => {
    voteSettingsMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card backdrop-blur-xl border border-border card-glow">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              <Settings className="text-primary" size={24} />
              <span>Game Settings Voting</span>
            </CardTitle>
            <p className="text-muted-foreground">
              Both players need to agree on game settings before starting
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Clock size={16} />
              <span>Voting deadline: {timeLeft}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Players voting status */}
            <div className="bg-secondary/10 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                <Users className="mr-2" size={18} />
                Voting Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium">{game.player1?.firstName || 'Player 1'}</div>
                  <div className={`text-xs ${player1Vote.numDecks ? 'text-green-500' : 'text-yellow-500'}`}>
                    {player1Vote.numDecks ? '✓ Voted' : 'Waiting...'}
                  </div>
                  {player1Vote.numDecks && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {player1Vote.numDecks} deck{player1Vote.numDecks > 1 ? 's' : ''}, 
                      {player1Vote.allowPeek ? ' peek allowed' : ' no peek'}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">{game.player2?.firstName || 'Player 2'}</div>
                  <div className={`text-xs ${player2Vote.numDecks ? 'text-green-500' : 'text-yellow-500'}`}>
                    {player2Vote.numDecks ? '✓ Voted' : 'Waiting...'}
                  </div>
                  {player2Vote.numDecks && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {player2Vote.numDecks} deck{player2Vote.numDecks > 1 ? 's' : ''}, 
                      {player2Vote.allowPeek ? ' peek allowed' : ' no peek'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!hasVoted ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Your Vote</h3>
                
                {/* Number of Decks */}
                <div className="space-y-2">
                  <Label htmlFor="numDecks">Number of Decks</Label>
                  <Select value={numDecks.toString()} onValueChange={(value) => setNumDecks(parseInt(value))}>
                    <SelectTrigger data-testid="select-num-decks">
                      <SelectValue placeholder="Select number of decks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Deck</SelectItem>
                      <SelectItem value="2">2 Decks</SelectItem>
                      <SelectItem value="3">3 Decks</SelectItem>
                      <SelectItem value="4">4 Decks</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    More decks increase randomness and game length
                  </p>
                </div>

                {/* Allow Peek */}
                <div className="space-y-2">
                  <Label htmlFor="allowPeek">Allow Face-Down Card Peek</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowPeek"
                      checked={allowPeek}
                      onCheckedChange={setAllowPeek}
                      data-testid="switch-allow-peek"
                    />
                    <span className="text-sm">
                      {allowPeek ? 'Players can peek at their face-down card' : 'No peeking allowed'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Peeking adds strategy but reduces suspense
                  </p>
                </div>

                <Button
                  onClick={handleSubmitVote}
                  disabled={voteSettingsMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid="button-submit-vote"
                >
                  {voteSettingsMutation.isPending ? 'Submitting...' : 'Submit Vote'}
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-green-500 text-lg font-semibold mb-2">✓ You have voted!</div>
                <p className="text-muted-foreground mb-4">
                  {otherPlayerVoted 
                    ? 'Both players have voted. Finalizing settings...' 
                    : 'Waiting for the other player to vote...'}
                </p>
                <div className="bg-secondary/10 rounded-lg p-3">
                  <div className="text-sm">
                    <strong>Your vote:</strong> {numDecks} deck{numDecks > 1 ? 's' : ''}, 
                    {allowPeek ? ' peek allowed' : ' no peek'}
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center">
              If players don't agree, settings will be chosen randomly from the votes.
              If voting expires, default settings will be used.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}