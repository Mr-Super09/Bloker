import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trophy, Spade, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer: User | null;
}

export function ChallengeModal({ isOpen, onClose, targetPlayer }: ChallengeModalProps) {
  const [challengeMessage, setChallengeMessage] = useState("");
  const [minBet, setMinBet] = useState("10");
  const [numDecks, setNumDecks] = useState("1");
  const [allowPeek, setAllowPeek] = useState(true);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const challengeMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', '/api/challenges', data);
    },
    onSuccess: () => {
      toast({
        title: "Challenge Sent",
        description: `Challenge sent to ${targetPlayer?.firstName}`,
      });
      onClose();
      resetForm();
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

  const resetForm = () => {
    setChallengeMessage("");
    setMinBet("10");
    setNumDecks("1");
    setAllowPeek(true);
  };

  const handleSendChallenge = () => {
    if (!targetPlayer) return;

    challengeMutation.mutate({
      challengedId: targetPlayer.id,
      message: challengeMessage,
      minBet: parseInt(minBet),
      gameSettings: {
        numDecks: parseInt(numDecks),
        allowPeek,
      },
    });
  };

  const handleClose = () => {
    onClose();
    if (!challengeMutation.isPending) {
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 card-glow">
              <Trophy className="text-white" size={24} />
            </div>
            <DialogTitle className="text-xl font-bold mb-2">Challenge Player</DialogTitle>
            <p className="text-muted-foreground">
              Send a Bloker challenge to {targetPlayer?.firstName}
            </p>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 mb-6">
          {/* Challenge Message */}
          <div>
            <Label htmlFor="challenge-message" className="text-sm font-medium">
              Challenge Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea 
              id="challenge-message"
              placeholder="Add a personal message to your challenge..."
              value={challengeMessage}
              onChange={(e) => setChallengeMessage(e.target.value)}
              className="mt-2 resize-none bg-input/50"
              rows={3}
              maxLength={200}
              data-testid="input-challenge-message"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {challengeMessage.length}/200 characters
            </div>
          </div>

          {/* Minimum Bet */}
          <div>
            <Label htmlFor="min-bet" className="text-sm font-medium">
              Minimum Bet
            </Label>
            <Select value={minBet} onValueChange={setMinBet}>
              <SelectTrigger className="mt-2 bg-input/50" data-testid="select-min-bet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">$10</SelectItem>
                <SelectItem value="25">$25</SelectItem>
                <SelectItem value="50">$50</SelectItem>
                <SelectItem value="100">$100</SelectItem>
                <SelectItem value="250">$250</SelectItem>
                <SelectItem value="500">$500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Game Settings */}
          <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <Settings size={16} className="text-primary" />
              <span>Game Settings</span>
            </div>
            
            <div>
              <Label htmlFor="num-decks" className="text-sm font-medium">
                Number of Decks
              </Label>
              <Select value={numDecks} onValueChange={setNumDecks}>
                <SelectTrigger className="mt-2 bg-input/50" data-testid="select-num-decks">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Deck (52 cards)</SelectItem>
                  <SelectItem value="2">2 Decks (104 cards)</SelectItem>
                  <SelectItem value="3">3 Decks (156 cards)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allow-peek" className="text-sm font-medium">
                  Allow Face-down Peek
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Let players see their own face-down cards
                </p>
              </div>
              <Switch
                id="allow-peek"
                checked={allowPeek}
                onCheckedChange={setAllowPeek}
                data-testid="switch-allow-peek"
              />
            </div>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            onClick={handleSendChallenge}
            disabled={challengeMutation.isPending}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-3 shine-effect relative overflow-hidden"
            data-testid="button-send-challenge"
          >
            <Spade className="mr-2" size={16} />
            {challengeMutation.isPending ? 'Sending...' : 'Send Challenge'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleClose}
            disabled={challengeMutation.isPending}
            className="flex-1 py-3"
            data-testid="button-cancel-challenge"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
