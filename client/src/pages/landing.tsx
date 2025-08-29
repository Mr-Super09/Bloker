import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spade, Trophy, Users, MessageCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
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
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 shine-effect relative overflow-hidden"
            data-testid="button-login"
          >
            Login to Play
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-8 animate-float card-glow">
            <Spade className="text-white" size={48} />
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Welcome to Bloker
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the ultimate fusion of Blackjack and Poker in real-time multiplayer battles. 
            Challenge players worldwide in this innovative card game that combines strategy, skill, and excitement.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-4 text-lg shine-effect relative overflow-hidden"
            data-testid="button-get-started"
          >
            Get Started Now
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-card/50 backdrop-blur-xl border border-border card-glow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mb-4">
                <Users className="text-white" size={24} />
              </div>
              <CardTitle>Real-Time Multiplayer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Challenge players from around the world in live 1v1 Bloker matches with instant updates and smooth gameplay.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-xl border border-border card-glow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-secondary to-accent rounded-lg flex items-center justify-center mb-4">
                <Trophy className="text-white" size={24} />
              </div>
              <CardTitle>Unique Game Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Experience Bloker's innovative fusion of Blackjack and Poker with betting rounds, face-down cards, and strategic gameplay.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-xl border border-border card-glow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="text-white" size={24} />
              </div>
              <CardTitle>Social Features</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Chat with opponents, track your stats, and build your reputation in the Bloker community with comprehensive social features.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Game Rules Section */}
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-8 card-glow">
          <h3 className="text-2xl font-bold mb-6 text-center">How to Play Bloker</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-4 text-primary">Game Setup</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Choose 1-3 standard 52-card decks</li>
                <li>• Decks are shuffled and split evenly between players</li>
                <li>• Each player receives 1 face-up and 1 face-down card</li>
                <li>• Optional: Allow players to peek at their face-down card</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-secondary">Gameplay</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Betting phase with raise/match options</li>
                <li>• Reveal face-down cards after betting</li>
                <li>• Hit or Stay until both players are done</li>
                <li>• Closest to 21 without busting wins the pot</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-xl py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            © 2024 Bloker. Experience the future of card games.
          </p>
        </div>
      </footer>
    </div>
  );
}
