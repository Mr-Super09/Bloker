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
      
      // Create game
      const game = await storage.createGame({
        player1Id: challenge.challengerId,
        player2Id: challenge.challengedId,
        numDecks: (challenge.gameSettings as any)?.numDecks || 1,
        allowPeek: (challenge.gameSettings as any)?.allowPeek ?? true,
      });
      
      // Update challenge
      await storage.updateChallenge(challengeId, {
        status: 'accepted',
        gameId: game.id,
      });
      
      // Initialize game
      await initializeGame(game.id, game.numDecks || 1);
      
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
      
      const remainingCards: Card[] = JSON.parse(game.remainingCards as string);
      const newCard = remainingCards.pop()!;
      newCard.faceUp = true;
      
      const updates: any = {
        remainingCards: JSON.stringify(remainingCards),
      };
      
      if (isPlayer1) {
        const player1Hand: Card[] = JSON.parse(game.player1Hand as string);
        player1Hand.push(newCard);
        updates.player1Hand = JSON.stringify(player1Hand);
        
        // Check for bust
        if (calculateHandValue(player1Hand) > 21) {
          updates.player1Busted = true;
        }
      } else {
        const player2Hand: Card[] = JSON.parse(game.player2Hand as string);
        player2Hand.push(newCard);
        updates.player2Hand = JSON.stringify(player2Hand);
        
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
        const player1Hand: Card[] = JSON.parse(game.player1Hand as string);
        const player2Hand: Card[] = JSON.parse(game.player2Hand as string);
        
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
