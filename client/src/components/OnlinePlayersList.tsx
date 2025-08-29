import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, Users, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function OnlinePlayersList() {
  const [challengeMessage, setChallengeMessage] = useState("");
  const [minBet, setMinBet] = useState("10");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: onlineUsers = [], isLoading } = useQuery({
    queryKey: ['/api/users/online'],
    refetchInterval: 5000, // Refresh every 5 seconds
  }) as { data: any[], isLoading: boolean };

  const challengeMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', '/api/challenges', data);
    },
    onSuccess: () => {
      toast({
        title: "Challenge Sent",
        description: `Challenge sent to ${selectedPlayer?.firstName}`,
      });
      setIsDialogOpen(false);
      setChallengeMessage("");
      setMinBet("10");
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChallenge = (player: any) => {
    setSelectedPlayer(player);
    setIsDialogOpen(true);
  };

  const handleSendChallenge = () => {
    if (!selectedPlayer) return;

    challengeMutation.mutate({
      challengedId: selectedPlayer.id,
      message: challengeMessage,
      minBet: parseInt(minBet),
      gameSettings: {
        numDecks: 1,
        allowPeek: true,
      },
    });
  };

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-lg p-6 card-glow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Users className="text-primary mr-2" size={20} />
        Online Players
        <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
          {onlineUsers.length}
        </span>
      </h3>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">
            Loading players...
          </div>
        ) : onlineUsers.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No other players online
          </div>
        ) : (
          onlineUsers.map((player: any) => (
            <div 
              key={player.id}
              className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
              data-testid={`player-item-${player.id}`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center relative">
                  {player.profileImageUrl ? (
                    <img 
                      src={player.profileImageUrl} 
                      alt={player.firstName} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="text-white text-xs" size={12} />
                  )}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                </div>
                <div>
                  <div className="text-sm font-medium" data-testid={`player-name-${player.id}`}>
                    {player.firstName || 'Anonymous'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    W: {player.wins} L: {player.losses}
                  </div>
                </div>
              </div>
              <Button 
                size="sm"
                onClick={() => handleChallenge(player)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 text-xs shine-effect relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/25"
                data-testid={`button-challenge-${player.id}`}
              >
                Challenge
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border border-border">
          <DialogHeader>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="text-white" size={24} />
              </div>
              <DialogTitle className="text-xl font-bold mb-2">Challenge Player</DialogTitle>
              <p className="text-muted-foreground">
                Send a Bloker challenge to {selectedPlayer?.firstName}
              </p>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="challenge-message" className="text-sm font-medium">
                Challenge Message
              </Label>
              <Textarea 
                id="challenge-message"
                placeholder="Optional message..."
                value={challengeMessage}
                onChange={(e) => setChallengeMessage(e.target.value)}
                className="mt-2 resize-none"
                rows={3}
                data-testid="input-challenge-message"
              />
            </div>
            <div>
              <Label htmlFor="min-bet" className="text-sm font-medium">
                Minimum Bet
              </Label>
              <Select value={minBet} onValueChange={setMinBet}>
                <SelectTrigger className="mt-2" data-testid="select-min-bet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">$10</SelectItem>
                  <SelectItem value="25">$25</SelectItem>
                  <SelectItem value="50">$50</SelectItem>
                  <SelectItem value="100">$100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              onClick={handleSendChallenge}
              disabled={challengeMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-3 shine-effect relative overflow-hidden"
              data-testid="button-send-challenge"
            >
              Send Challenge
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="flex-1 py-3"
              data-testid="button-cancel-challenge"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
