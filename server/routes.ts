import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertChallengeSchema, insertChatMessageSchema, type Card } from "@shared/schema";
import { z } from "zod";

// Game engine utilities
function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values: Card['value'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value, faceUp: false });
    }
  }
  
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardValue(card: Card): number {
  if (card.value === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value);
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

async function finalizeGameSettings(gameId: string, player1Vote: any, player2Vote: any): Promise<void> {
  let finalNumDecks = 1;
  let finalAllowPeek = true;
  
  // If votes match, use the agreed setting
  if (player1Vote.numDecks === player2Vote.numDecks) {
    finalNumDecks = player1Vote.numDecks;
  } else {
    // If votes don't match, randomly choose one player's vote
    const randomPlayer = Math.random() < 0.5 ? player1Vote : player2Vote;
    finalNumDecks = randomPlayer.numDecks;
  }
  
  if (player1Vote.allowPeek === player2Vote.allowPeek) {
    finalAllowPeek = player1Vote.allowPeek;
  } else {
    // If votes don't match, randomly choose one player's vote
    const randomPlayer = Math.random() < 0.5 ? player1Vote : player2Vote;
    finalAllowPeek = randomPlayer.allowPeek;
  }
  
  // Update game with final settings and initialize
  await storage.updateGame(gameId, {
    numDecks: finalNumDecks,
    allowPeek: finalAllowPeek,
  });
  
  // Initialize the game with the final settings
  await initializeGame(gameId, finalNumDecks);
}

async function checkExpiredVotingDeadlines(): Promise<void> {
  try {
    // Get all games in setting_up state with expired voting deadlines
    const expiredGames = await storage.getGamesWithExpiredVoting();
    
    for (const game of expiredGames) {
      let player1Vote = {};
      let player2Vote = {};
      
      try {
        player1Vote = typeof game.player1SettingsVote === 'string' 
          ? JSON.parse(game.player1SettingsVote) 
          : game.player1SettingsVote || {};
      } catch {
        player1Vote = {};
      }
      
      try {
        player2Vote = typeof game.player2SettingsVote === 'string' 
          ? JSON.parse(game.player2SettingsVote) 
          : game.player2SettingsVote || {};
      } catch {
        player2Vote = {};
      }
      
      // Use available votes or defaults
      const finalPlayer1Vote = {
        numDecks: (player1Vote as any).numDecks || 1,
        allowPeek: (player1Vote as any).allowPeek ?? true
      };
      const finalPlayer2Vote = {
        numDecks: (player2Vote as any).numDecks || 1,
        allowPeek: (player2Vote as any).allowPeek ?? true
      };
      
      await finalizeGameSettings(game.id, finalPlayer1Vote, finalPlayer2Vote);
    }
  } catch (error) {
    console.error("Error checking expired voting deadlines:", error);
  }
}

async function initializeGame(gameId: string, numDecks: number = 1): Promise<void> {
  // Create and shuffle deck(s)
  let allCards: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    allCards = allCards.concat(createDeck());
  }
  allCards = shuffleDeck(allCards);
  
  // Deal initial cards
  const player1Hand = [allCards.pop()!, allCards.pop()!];
  const player2Hand = [allCards.pop()!, allCards.pop()!];
  
  // Set face-up/face-down
  player1Hand[0].faceUp = true;  // First card face-up
  player1Hand[1].faceUp = false; // Second card face-down
  player2Hand[0].faceUp = true;  // First card face-up
  player2Hand[1].faceUp = false; // Second card face-down
  
  await storage.updateGame(gameId, {
    remainingCards: JSON.stringify(allCards),
    player1Hand: JSON.stringify(player1Hand),
    player2Hand: JSON.stringify(player2Hand),
    state: 'cards_dealt',
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Start background task to check expired voting deadlines
  setInterval(checkExpiredVotingDeadlines, 5000); // Check every 5 seconds

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Update online status
      if (user) {
        await storage.updateUserOnlineStatus(userId, true);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes
  app.get('/api/users/online', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const onlineUsers = await storage.getOnlineUsers(userId);
      res.json(onlineUsers);
    } catch (error) {
      console.error("Error fetching online users:", error);
      res.status(500).json({ message: "Failed to fetch online users" });
    }
  });

  app.post('/api/users/offline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserOnlineStatus(userId, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Challenge routes
  app.get('/api/challenges', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challenges = await storage.getChallengesForUser(userId);
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  app.post('/api/challenges', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeData = insertChallengeSchema.parse({
        ...req.body,
        challengerId: userId,
      });
      
      const challenge = await storage.createChallenge(challengeData);
      res.json(challenge);
    } catch (error) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ message: "Failed to create challenge" });
    }
  });

  app.post('/api/challenges/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      const challenge = await storage.getChallenge(challengeId);
      if (!challenge || challenge.challengedId !== userId) {
        return res.status(404).json({ message: "Challenge not found" });
      }
      
      // Create game in setting_up state for voting on settings
      const settingsDeadline = new Date(Date.now() + 60000); // 1 minute to vote
      const game = await storage.createGame({
        player1Id: challenge.challengerId,
        player2Id: challenge.challengedId,
        state: 'setting_up',
        settingsVotingDeadline: settingsDeadline,
      });
      
      // Update challenge
      await storage.updateChallenge(challengeId, {
        status: 'accepted',
        gameId: game.id,
      });
      
      res.json({ challenge, game });
    } catch (error) {
      console.error("Error accepting challenge:", error);
      res.status(500).json({ message: "Failed to accept challenge" });
    }
  });

  app.post('/api/challenges/:id/decline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      const challenge = await storage.getChallenge(challengeId);
      if (!challenge || challenge.challengedId !== userId) {
        return res.status(404).json({ message: "Challenge not found" });
      }
      
      await storage.updateChallenge(challengeId, { status: 'declined' });
      res.json({ success: true });
    } catch (error) {
      console.error("Error declining challenge:", error);
      res.status(500).json({ message: "Failed to decline challenge" });
    }
  });

  // Game routes
  app.get('/api/games/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const game = await storage.getUserActiveGame(userId);
      res.json(game);
    } catch (error) {
      console.error("Error fetching active game:", error);
      res.status(500).json({ message: "Failed to fetch active game" });
    }
  });

  app.get('/api/games/:id', isAuthenticated, async (req: any, res) => {
    try {
      const game = await storage.getGameWithPlayers(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // Settings voting routes
  app.post('/api/games/:id/vote-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      const { numDecks, allowPeek } = req.body;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.state !== 'setting_up') {
        return res.status(400).json({ message: "Game is not in settings voting phase" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      const settingsVote = { numDecks, allowPeek, votedAt: new Date() };
      const updates: any = {};
      
      if (isPlayer1) {
        updates.player1SettingsVote = JSON.stringify(settingsVote);
      } else {
        updates.player2SettingsVote = JSON.stringify(settingsVote);
      }
      
      const updatedGame = await storage.updateGame(gameId, updates);
      
      // Check if both players have voted
      const player1Vote = isPlayer1 ? settingsVote : (typeof updatedGame.player1SettingsVote === 'string' ? JSON.parse(updatedGame.player1SettingsVote) : updatedGame.player1SettingsVote || {});
      const player2Vote = isPlayer2 ? settingsVote : (typeof updatedGame.player2SettingsVote === 'string' ? JSON.parse(updatedGame.player2SettingsVote) : updatedGame.player2SettingsVote || {});
      
      if (player1Vote.numDecks && player2Vote.numDecks) {
        // Both players have voted, finalize settings
        await finalizeGameSettings(gameId, player1Vote, player2Vote);
      }
      
      res.json(updatedGame);
    } catch (error) {
      console.error("Error voting on settings:", error);
      res.status(500).json({ message: "Failed to vote on settings" });
    }
  });

  app.post('/api/games/:id/bet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      const { amount } = req.body;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      const updates: any = {
        pot: game.pot + amount,
      };
      
      if (isPlayer1) {
        updates.player1Bet = game.player1Bet + amount;
      } else {
        updates.player2Bet = game.player2Bet + amount;
      }
      
      const updatedGame = await storage.updateGame(gameId, updates);
      res.json(updatedGame);
    } catch (error) {
      console.error("Error placing bet:", error);
      res.status(500).json({ message: "Failed to place bet" });
    }
  });

  app.post('/api/games/:id/hit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      const remainingCards: Card[] = Array.isArray(game.remainingCards) 
        ? game.remainingCards 
        : (typeof game.remainingCards === 'string' ? JSON.parse(game.remainingCards) : []);
      
      if (remainingCards.length === 0) {
        return res.status(400).json({ message: "No cards remaining" });
      }
      
      const newCard = remainingCards.pop()!;
      newCard.faceUp = true;
      
      const updates: any = {
        remainingCards: remainingCards,
      };
      
      if (isPlayer1) {
        const player1Hand: Card[] = Array.isArray(game.player1Hand) 
          ? game.player1Hand 
          : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
        player1Hand.push(newCard);
        updates.player1Hand = player1Hand;
        
        // Check for bust
        if (calculateHandValue(player1Hand) > 21) {
          updates.player1Busted = true;
        }
      } else {
        const player2Hand: Card[] = Array.isArray(game.player2Hand) 
          ? game.player2Hand 
          : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
        player2Hand.push(newCard);
        updates.player2Hand = player2Hand;
        
        // Check for bust
        if (calculateHandValue(player2Hand) > 21) {
          updates.player2Busted = true;
        }
      }
      
      const updatedGame = await storage.updateGame(gameId, updates);
      res.json(updatedGame);
    } catch (error) {
      console.error("Error hitting:", error);
      res.status(500).json({ message: "Failed to hit" });
    }
  });

  app.post('/api/games/:id/stay', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      const updates: any = {};
      
      if (isPlayer1) {
        updates.player1Ready = true;
      } else {
        updates.player2Ready = true;
      }
      
      // Check if both players are ready to determine winner
      if ((isPlayer1 && game.player2Ready) || (isPlayer2 && game.player1Ready)) {
        const player1Hand: Card[] = Array.isArray(game.player1Hand) 
          ? game.player1Hand 
          : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
        const player2Hand: Card[] = Array.isArray(game.player2Hand) 
          ? game.player2Hand 
          : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
        
        const player1Value = calculateHandValue(player1Hand);
        const player2Value = calculateHandValue(player2Hand);
        
        let winnerId = null;
        
        // Determine winner
        if (game.player1Busted && !game.player2Busted) {
          winnerId = game.player2Id;
        } else if (game.player2Busted && !game.player1Busted) {
          winnerId = game.player1Id;
        } else if (!game.player1Busted && !game.player2Busted) {
          if (player1Value > player2Value) {
            winnerId = game.player1Id;
          } else if (player2Value > player1Value) {
            winnerId = game.player2Id;
          }
          // Tie case would trigger tiebreaker logic
        }
        
        if (winnerId) {
          updates.winnerId = winnerId;
          updates.state = 'finished';
          
          // Update player stats
          await storage.updateUserStats(game.player1Id, winnerId === game.player1Id, winnerId === game.player1Id ? (game.pot || 0) : 0);
          await storage.updateUserStats(game.player2Id!, winnerId === game.player2Id, winnerId === game.player2Id ? (game.pot || 0) : 0);
        }
      }
      
      const updatedGame = await storage.updateGame(gameId, updates);
      res.json(updatedGame);
    } catch (error) {
      console.error("Error staying:", error);
      res.status(500).json({ message: "Failed to stay" });
    }
  });

  // Chat routes
  app.get('/api/games/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const gameId = req.params.id;
      const messages = await storage.getChatMessages(gameId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/games/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      // Calculate the pot and winnings
      const leaverBet = isPlayer1 ? (game.player1Bet || 0) : (game.player2Bet || 0);
      const remainingPlayerBet = isPlayer1 ? (game.player2Bet || 0) : (game.player1Bet || 0);
      const totalPot = leaverBet + remainingPlayerBet;
      
      // The remaining player wins both bets
      const winnerId = isPlayer1 ? game.player2Id : game.player1Id;
      const loserId = userId;
      
      // Update game state
      await storage.updateGame(gameId, { 
        state: 'finished',
        winnerId: winnerId,
        pot: totalPot
      });
      
      // Update winner's stats (wins, total winnings, credits)
      const winner = await storage.getUser(winnerId);
      if (winner) {
        await storage.updateUser(winnerId, {
          wins: (winner.wins || 0) + 1,
          totalWinnings: (winner.totalWinnings || 0) + totalPot,
          credits: (winner.credits || 0) + totalPot
        });
      }
      
      // Update loser's stats (losses, credits decreased by their bet)
      const loser = await storage.getUser(loserId);
      if (loser) {
        await storage.updateUser(loserId, {
          losses: (loser.losses || 0) + 1,
          credits: Math.max(0, (loser.credits || 0) - leaverBet) // Don't go below 0
        });
      }
      
      // Add system message to chat
      await storage.createChatMessage({
        gameId,
        userId: null,
        message: `${loser?.firstName || 'Player'} left the game. ${winner?.firstName || 'Player'} wins $${totalPot}!`,
        isSystemMessage: true,
      });
      
      res.json({ success: true, winnings: totalPot });
    } catch (error) {
      console.error("Error leaving game:", error);
      res.status(500).json({ message: "Failed to leave game" });
    }
  });

  app.post('/api/games/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      
      const messageData = insertChatMessageSchema.parse({
        gameId,
        userId,
        message: req.body.message,
        isSystemMessage: false,
      });
      
      const message = await storage.createChatMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
