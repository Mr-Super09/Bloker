import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowDown, ArrowUp, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export function ChallengesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['/api/challenges'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const acceptMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      await apiRequest('POST', `/api/challenges/${challengeId}/accept`, {});
    },
    onSuccess: (data) => {
      toast({
        title: "Challenge Accepted",
        description: "Game is starting...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games'] });
      // TODO: Navigate to game
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      await apiRequest('POST', `/api/challenges/${challengeId}/decline`, {});
    },
    onSuccess: () => {
      toast({
        title: "Challenge Declined",
        description: "Challenge has been declined",
      });
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

  const incomingChallenges = challenges.filter((c: any) => c.status === 'pending' && c.challenged?.id);
  const sentChallenges = challenges.filter((c: any) => c.status === 'pending' && c.challenger?.id);

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-lg p-6 card-glow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Trophy className="text-accent mr-2" size={20} />
        Challenges
        <span className="ml-auto bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full notification-badge">
          {incomingChallenges.length + sentChallenges.length}
        </span>
      </h3>
      
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">
            Loading challenges...
          </div>
        ) : (incomingChallenges.length + sentChallenges.length) === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No active challenges
          </div>
        ) : (
          <>
            {/* Incoming Challenges */}
            {incomingChallenges.map((challenge: any) => (
              <div 
                key={challenge.id}
                className="p-4 bg-secondary/10 border border-secondary/20 rounded-lg"
                data-testid={`challenge-incoming-${challenge.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <ArrowDown className="text-secondary" size={16} />
                    <span className="text-sm font-medium">Incoming</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <Clock size={12} className="mr-1" />
                    {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="text-sm mb-3">
                  <strong data-testid={`challenger-name-${challenge.id}`}>
                    {challenge.challenger?.firstName || 'Unknown'}
                  </strong> challenges you to Bloker
                  {challenge.message && (
                    <div className="text-xs text-muted-foreground mt-1 italic">
                      "{challenge.message}"
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Minimum bet: ${challenge.minBet}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    size="sm"
                    onClick={() => acceptMutation.mutate(challenge.id)}
                    disabled={acceptMutation.isPending}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-3 py-1 text-xs flex-1 shine-effect relative overflow-hidden"
                    data-testid={`button-accept-${challenge.id}`}
                  >
                    Accept
                  </Button>
                  <Button 
                    size="sm"
                    variant="destructive"
                    onClick={() => declineMutation.mutate(challenge.id)}
                    disabled={declineMutation.isPending}
                    className="px-3 py-1 text-xs flex-1"
                    data-testid={`button-decline-${challenge.id}`}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}

            {/* Sent Challenges */}
            {sentChallenges.map((challenge: any) => (
              <div 
                key={challenge.id}
                className="p-4 bg-accent/10 border border-accent/20 rounded-lg"
                data-testid={`challenge-sent-${challenge.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <ArrowUp className="text-accent" size={16} />
                    <span className="text-sm font-medium">Sent</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <Clock size={12} className="mr-1" />
                    {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="text-sm mb-3">
                  Waiting for <strong data-testid={`challenged-name-${challenge.id}`}>
                    {challenge.challenged?.firstName || 'Unknown'}
                  </strong> to respond
                  {challenge.message && (
                    <div className="text-xs text-muted-foreground mt-1 italic">
                      Your message: "{challenge.message}"
                    </div>
                  )}
                </div>
                <Button 
                  size="sm"
                  variant="outline"
                  className="text-xs w-full"
                  data-testid={`button-cancel-${challenge.id}`}
                >
                  Cancel
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
