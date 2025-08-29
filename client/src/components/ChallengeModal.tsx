import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trophy, Spade } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer: User | null;
}

export function ChallengeModal({ isOpen, onClose, targetPlayer }: ChallengeModalProps) {
  const [challengeMessage, setChallengeMessage] = useState("");
  
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
  };

  const handleSendChallenge = () => {
    if (!targetPlayer) return;

    challengeMutation.mutate({
      challengedId: targetPlayer.id,
      message: challengeMessage,
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

          {/* Note about game settings */}
          <div className="text-center p-4 bg-muted/10 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Game settings (number of decks, peek options) will be decided together when the game starts
            </p>
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
