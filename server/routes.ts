import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertChallengeSchema, insertChatMessageSchema, type Card } from "@shared/schema";
import { z } from "zod";
import { gameLogic } from "./gameLogic.js";

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

async function moveToHitStayPhase(gameId: string): Promise<void> {
  const game = await storage.getGame(gameId);
  if (!game) return;
  
  const updates: any = { state: 'hitting_staying' };
  
  // If allowPeek is enabled, players can now see their face-down cards
  if (game.allowPeek) {
    const player1Hand: Card[] = Array.isArray(game.player1Hand) 
      ? game.player1Hand 
      : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
    const player2Hand: Card[] = Array.isArray(game.player2Hand) 
      ? game.player2Hand 
      : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
      
    // Reveal face down cards to players (for peek)
    player1Hand.forEach(card => { if (!card.faceUp) card.faceUp = true; });
    player2Hand.forEach(card => { if (!card.faceUp) card.faceUp = true; });
    
    updates.player1Hand = JSON.stringify(player1Hand);
    updates.player2Hand = JSON.stringify(player2Hand);
  }
  
  await storage.updateGame(gameId, updates);
}

async function startNextRound(gameId: string, roundWinnerId: string): Promise<void> {
  const game = await storage.getGame(gameId);
  if (!game) return;
  
  // Check if either player is out of cards
  const player1Cards: Card[] = Array.isArray(game.player1Cards) 
    ? game.player1Cards 
    : (typeof game.player1Cards === 'string' ? JSON.parse(game.player1Cards) : []);
  const player2Cards: Card[] = Array.isArray(game.player2Cards) 
    ? game.player2Cards 
    : (typeof game.player2Cards === 'string' ? JSON.parse(game.player2Cards) : []);
  
  if (player1Cards.length === 0 || player2Cards.length === 0) {
    // Game ends - player with cards wins
    const finalWinnerId = player1Cards.length > 0 ? game.player1Id : game.player2Id;
    await storage.updateGame(gameId, {
      winnerId: finalWinnerId,
      state: 'finished',
      gameFinishedAt: new Date(),
    });
    
    await storage.updateUserStats(finalWinnerId!, true, 0);
    await storage.updateUserStats(finalWinnerId === game.player1Id ? game.player2Id! : game.player1Id!, false, 0);
    
    await storage.createChatMessage({
      gameId,
      userId: null,
      message: `Game Over! ${finalWinnerId === game.player1Id ? 'Player 1' : 'Player 2'} wins - opponent ran out of cards!`,
      isSystemMessage: true,
    });
    return;
  }
  
  // Both players still have cards - start next round
  // Each player draws 2 new cards (1 face-up, 1 face-down)
  const player1FaceUp = player1Cards.pop()!;
  const player1FaceDown = player1Cards.pop()!;
  const player2FaceUp = player2Cards.pop()!;
  const player2FaceDown = player2Cards.pop()!;
  
  player1FaceUp.faceUp = true;
  player1FaceDown.faceUp = false;
  player2FaceUp.faceUp = true;
  player2FaceDown.faceUp = false;
  
  const player1Hand = [player1FaceUp, player1FaceDown];
  const player2Hand = [player2FaceUp, player2FaceDown];
  
  // Set new betting deadline (25 seconds)
  const bettingDeadline = new Date(Date.now() + 25000);
  
  await storage.updateGame(gameId, {
    player1Cards: JSON.stringify(player1Cards),
    player2Cards: JSON.stringify(player2Cards),
    player1Hand: JSON.stringify(player1Hand),
    player2Hand: JSON.stringify(player2Hand),
    player1InitialCards: JSON.stringify([player1FaceUp, player1FaceDown]),
    player2InitialCards: JSON.stringify([player2FaceUp, player2FaceDown]),
    bettingDeadline: bettingDeadline,
    state: 'betting',
    player1Bet: 0,
    player2Bet: 0,
    player1Folded: false,
    player2Folded: false,
    player1Busted: false,
    player2Busted: false,
    currentRound: (game.currentRound || 1) + 1,
  });
  
  await storage.createChatMessage({
    gameId,
    userId: null,
    message: `Round ${(game.currentRound || 1) + 1} begins! New cards dealt. Betting phase starts now - 25 seconds!`,
    isSystemMessage: true,
  });
}

async function determineRoundWinner(gameId: string): Promise<void> {
  const game = await storage.getGame(gameId);
  if (!game) return;
  
  const player1Hand: Card[] = Array.isArray(game.player1Hand) 
    ? game.player1Hand 
    : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
  const player2Hand: Card[] = Array.isArray(game.player2Hand) 
    ? game.player2Hand 
    : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
  
  const player1Value = calculateHandValue(player1Hand);
  const player2Value = calculateHandValue(player2Hand);
  const player1Busted = player1Value > 21;
  const player2Busted = player2Value > 21;
  
  let winnerId: string | null = null;
  let message = '';
  
  // Determine winner
  if (player1Busted && player2Busted) {
    message = 'Both players busted! It\'s a tie.';
  } else if (player1Busted && !player2Busted) {
    winnerId = game.player2Id;
    message = `Player 1 busted with ${player1Value}. Player 2 wins with ${player2Value}!`;
  } else if (player2Busted && !player1Busted) {
    winnerId = game.player1Id;
    message = `Player 2 busted with ${player2Value}. Player 1 wins with ${player1Value}!`;
  } else if (player1Value === player2Value) {
    // Tie - start tiebreaker
    await startTiebreaker(gameId);
    return;
  } else if (player1Value > player2Value) {
    winnerId = game.player1Id;
    message = `Player 1 wins with ${player1Value} vs Player 2's ${player2Value}!`;
  } else {
    winnerId = game.player2Id;
    message = `Player 2 wins with ${player2Value} vs Player 1's ${player1Value}!`;
  }
  
  if (winnerId) {
    // Winner gets all cards played this round plus betting pot
    const totalPot = (game.player1Bet || 0) + (game.player2Bet || 0);
    
    // Add pot cards and played cards to winner's pile
    const winnerCardsData = winnerId === game.player1Id ? game.player1Cards : game.player2Cards;
    const winnerCards: Card[] = Array.isArray(winnerCardsData) 
      ? winnerCardsData as Card[]
      : (typeof winnerCardsData === 'string' ? JSON.parse(winnerCardsData) : []);
    
    // Add pot cards
    for (let i = 0; i < totalPot; i++) {
      const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const values: ('A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K')[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      winnerCards.push({
        suit: suits[Math.floor(Math.random() * suits.length)],
        value: values[Math.floor(Math.random() * values.length)],
        faceUp: false
      });
    }
    
    // Add all played cards to winner's pile
    winnerCards.push(...player1Hand, ...player2Hand);
    
    // Update winner's cards
    if (winnerId === game.player1Id) {
      await storage.updateGame(gameId, {
        player1Cards: JSON.stringify(winnerCards)
      });
    } else {
      await storage.updateGame(gameId, {
        player2Cards: JSON.stringify(winnerCards)
      });
    }
    
    await storage.createChatMessage({
      gameId,
      userId: null,
      message: message,
      isSystemMessage: true,
    });
    
    // Start next round
    await startNextRound(gameId, winnerId);
  } else {
    // Tie case handled separately
    await storage.createChatMessage({
      gameId,
      userId: null,
      message: message,
      isSystemMessage: true,
    });
  }
}

async function startTiebreaker(gameId: string): Promise<void> {
  await storage.updateGame(gameId, {
    state: 'tiebreaker'
  });
  
  await storage.createChatMessage({
    gameId,
    userId: null,
    message: 'It\'s a tie! Starting tiebreaker round...',
    isSystemMessage: true,
  });
  
  // Tiebreaker logic would go here - for now, just start next round
  // In a full implementation, players would draw face-down cards and compare ranks
  await startNextRound(gameId, null);
}

async function checkExpiredDeadlines(): Promise<void> {
  try {
    // Check expired voting deadlines
    const expiredVotingGames = await storage.getGamesWithExpiredVoting();
    
    for (const game of expiredVotingGames) {
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
    
    // Check expired betting deadlines
    const expiredBettingGames = await storage.getGamesWithExpiredBetting();
    
    for (const game of expiredBettingGames) {
      // Time's up for betting - proceed to hit/stay phase
      await moveToHitStayPhase(game.id);
      
      await storage.createChatMessage({
        gameId: game.id,
        userId: null,
        message: 'Betting time expired! Moving to hit/stay phase.',
        isSystemMessage: true,
      });
    }
    
    // Check for games that finished and need auto-leave
    const finishedGames = await storage.getFinishedGamesForAutoLeave();
    
    for (const game of finishedGames) {
      // Delete game after 5 seconds of being finished (auto-leave)
      await storage.deleteGame(game.id);
      
      await storage.createChatMessage({
        gameId: game.id,
        userId: null,
        message: 'Game ended. Both players have been automatically removed.',
        isSystemMessage: true,
      });
    }
    
  } catch (error) {
    console.error("Error checking expired deadlines:", error);
  }
}

async function cleanupStaleOnlineUsers(): Promise<void> {
  try {
    // Mark users as offline if they haven't been active for more than 2 minutes
    await storage.cleanupStaleOnlineUsers(120000); // 2 minutes in milliseconds
  } catch (error) {
    console.error("Error cleaning up stale online users:", error);
  }
}

async function initializeGame(gameId: string, numDecks: number = 1): Promise<void> {
  // Create and shuffle deck(s)
  let allCards: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    allCards = allCards.concat(createDeck());
  }
  allCards = shuffleDeck(allCards);
  
  // Split deck evenly between players as personal card piles
  const halfwayPoint = Math.floor(allCards.length / 2);
  const player1Cards = allCards.slice(0, halfwayPoint);
  const player2Cards = allCards.slice(halfwayPoint);
  
  // Each player places one card face-up and one face-down from their pile
  const player1FaceUp = player1Cards.pop()!;
  const player1FaceDown = player1Cards.pop()!;
  const player2FaceUp = player2Cards.pop()!;
  const player2FaceDown = player2Cards.pop()!;
  
  player1FaceUp.faceUp = true;
  player1FaceDown.faceUp = false;
  player2FaceUp.faceUp = true;
  player2FaceDown.faceUp = false;
  
  const player1Hand = [player1FaceUp, player1FaceDown];
  const player2Hand = [player2FaceUp, player2FaceDown];
  
  // Set betting deadline (25 seconds)
  const bettingDeadline = new Date(Date.now() + 25000);
  
  await storage.updateGame(gameId, {
    player1Cards: JSON.stringify(player1Cards),
    player2Cards: JSON.stringify(player2Cards),
    player1Hand: JSON.stringify(player1Hand),
    player2Hand: JSON.stringify(player2Hand),
    player1InitialCards: JSON.stringify([player1FaceUp, player1FaceDown]),
    player2InitialCards: JSON.stringify([player2FaceUp, player2FaceDown]),
    bettingDeadline: bettingDeadline,
    state: 'betting',
    player1Bet: 0,
    player2Bet: 0,
    player1Folded: false,
    player2Folded: false,
    currentRound: 1,
  });
  
  // Add system message
  await storage.createChatMessage({
    gameId,
    userId: null,
    message: 'Game started! Each player has drawn 2 cards (1 face-up, 1 face-down). Betting phase begins now - you have 25 seconds!',
    isSystemMessage: true,
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Start background task to check expired deadlines
  setInterval(checkExpiredDeadlines, 5000); // Check every 5 seconds
  
  // Start background task to clean up stale online statuses
  setInterval(cleanupStaleOnlineUsers, 30000); // Check every 30 seconds

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

  app.post('/api/users/offline', async (req: any, res) => {
    try {
      // Handle both authenticated and beacon requests
      let userId;
      if (req.user && req.user.claims) {
        userId = req.user.claims.sub;
      } else if (req.session && req.session.user) {
        userId = req.session.user.id;
      } else {
        // For beacon requests without proper auth, try to get from session
        const sessionCookie = req.headers.cookie;
        if (sessionCookie) {
          // Extract session from cookie to get user ID
          const sessionData = req.session;
          if (sessionData && sessionData.passport && sessionData.passport.user) {
            userId = sessionData.passport.user.id;
          }
        }
      }
      
      if (userId) {
        await storage.updateUserOnlineStatus(userId, false);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.json({ success: true }); // Still return success to avoid client errors
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
      const settingsDeadline = new Date(Date.now() + 120000); // 2 minutes to vote
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

  // Card-based betting routes for Bloker
  app.post('/api/games/:id/bet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameId = req.params.id;
      const { action, cardCount } = req.body; // action: 'check', 'raise', 'fold', cardCount: number of cards to bet
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.state !== 'betting') {
        return res.status(400).json({ message: "Game is not in betting phase" });
      }
      
      const isPlayer1 = game.player1Id === userId;
      const isPlayer2 = game.player2Id === userId;
      
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: "Not a player in this game" });
      }
      
      // Check if this player has already folded
      if ((isPlayer1 && game.player1Folded) || (isPlayer2 && game.player2Folded)) {
        return res.status(400).json({ message: "You have already folded this round" });
      }
      
      const updates: any = {};
      
      if (action === 'fold') {
        // Player folds - loses their bet for this round but stays in game
        if (isPlayer1) {
          updates.player1Folded = true;
        } else {
          updates.player2Folded = true;
        }
        
        // Opponent wins the pot for this round
        const winnerId = isPlayer1 ? game.player2Id : game.player1Id;
        const loserBet = isPlayer1 ? (game.player1Bet || 0) : (game.player2Bet || 0);
        const winnerBet = isPlayer1 ? (game.player2Bet || 0) : (game.player1Bet || 0);
        const totalPot = loserBet + winnerBet;
        
        // Winner gets the pot cards added to their pile
        const winnerCardsData = isPlayer1 ? game.player2Cards : game.player1Cards;
        const winnerCards: Card[] = Array.isArray(winnerCardsData) 
          ? winnerCardsData as Card[]
          : (typeof winnerCardsData === 'string' 
             ? JSON.parse(winnerCardsData) : []);
        
        // Add the pot cards to winner's pile (represented as additional cards)
        for (let i = 0; i < totalPot; i++) {
          const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
          const values: ('A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K')[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
          winnerCards.push({
            suit: suits[Math.floor(Math.random() * suits.length)],
            value: values[Math.floor(Math.random() * values.length)],
            faceUp: false
          });
        }
        
        if (isPlayer1) {
          updates.player2Cards = JSON.stringify(winnerCards);
        } else {
          updates.player1Cards = JSON.stringify(winnerCards);
        }
        
        // Start next round
        await startNextRound(gameId, winnerId!);
        
        await storage.createChatMessage({
          gameId,
          userId: null,
          message: `${isPlayer1 ? 'Player 1' : 'Player 2'} folded and lost ${loserBet} cards. Starting next round...`,
          isSystemMessage: true,
        });
        
      } else if (action === 'check') {
        // Check - match opponent's bet or stay at current bet if no raise
        const opponentBet = isPlayer1 ? (game.player2Bet || 0) : (game.player1Bet || 0);
        const currentBet = isPlayer1 ? (game.player1Bet || 0) : (game.player2Bet || 0);
        
        if (opponentBet > currentBet) {
          // Must match the opponent's bet to check
          const betDifference = opponentBet - currentBet;
          
          // Get player's cards
          const playerCardsData = isPlayer1 ? game.player1Cards : game.player2Cards;
          const playerCards: Card[] = Array.isArray(playerCardsData) 
            ? playerCardsData as Card[]
            : (typeof playerCardsData === 'string' 
               ? JSON.parse(playerCardsData) : []);
          
          if (playerCards.length < betDifference) {
            return res.status(400).json({ message: "Not enough cards to match the bet" });
          }
          
          // Remove bet cards from player's pile
          for (let i = 0; i < betDifference; i++) {
            playerCards.pop();
          }
          
          if (isPlayer1) {
            updates.player1Bet = opponentBet;
            updates.player1Cards = JSON.stringify(playerCards);
          } else {
            updates.player2Bet = opponentBet;
            updates.player2Cards = JSON.stringify(playerCards);
          }
        }
        
        // Check if both players have equal bets (betting is complete)
        const finalPlayer1Bet = isPlayer1 ? (updates.player1Bet || game.player1Bet || 0) : (game.player1Bet || 0);
        const finalPlayer2Bet = isPlayer2 ? (updates.player2Bet || game.player2Bet || 0) : (game.player2Bet || 0);
        
        if (finalPlayer1Bet === finalPlayer2Bet) {
          updates.state = 'hitting_staying';
          
          // If allowPeek is enabled, players can now see their face-down cards
          if (game.allowPeek) {
            await moveToHitStayPhase(gameId);
            const updatedGame = await storage.updateGame(gameId, updates);
            return res.json(updatedGame);
          }
        }
        
      } else if (action === 'raise') {
        // Raise the bet by adding more cards
        if (!cardCount || cardCount <= 0) {
          return res.status(400).json({ message: "Invalid raise amount" });
        }
        
        // Get player's cards
        const playerCardsData = isPlayer1 ? game.player1Cards : game.player2Cards;
        const playerCards: Card[] = Array.isArray(playerCardsData) 
          ? playerCardsData as Card[]
          : (typeof playerCardsData === 'string' 
             ? JSON.parse(playerCardsData) : []);
        
        if (playerCards.length < cardCount) {
          return res.status(400).json({ message: "Not enough cards to raise by that amount" });
        }
        
        // Remove bet cards from player's pile
        for (let i = 0; i < cardCount; i++) {
          playerCards.pop();
        }
        
        if (isPlayer1) {
          updates.player1Bet = (game.player1Bet || 0) + cardCount;
          updates.player1Cards = JSON.stringify(playerCards);
        } else {
          updates.player2Bet = (game.player2Bet || 0) + cardCount;
          updates.player2Cards = JSON.stringify(playerCards);
        }
      }
      
      const updatedGame = await storage.updateGame(gameId, updates);
      res.json(updatedGame);
    } catch (error) {
      console.error("Error processing bet:", error);
      res.status(500).json({ message: "Failed to process bet" });
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
      
      // Check if player has already busted
      if ((isPlayer1 && game.player1Busted) || (isPlayer2 && game.player2Busted)) {
        return res.status(400).json({ message: "You have busted and cannot take any more actions." });
      }
      
      if (game.state !== 'hitting_staying') {
        return res.status(400).json({ message: "Game is not in hitting/staying phase" });
      }
      
      const updates: any = {};
      
      if (isPlayer1) {
        // Draw from player 1's personal card stack
        const player1Cards: Card[] = Array.isArray(game.player1Cards) 
          ? game.player1Cards 
          : (typeof game.player1Cards === 'string' ? JSON.parse(game.player1Cards) : []);
        
        if (player1Cards.length === 0) {
          // No cards left in personal stack - check if player has bet to continue with
          const playerBet = game.player1Bet || 0;
          if (playerBet === 0) {
            // Player loses - no cards and no bet to take from
            const totalPot = (game.player1Bet || 0) + (game.player2Bet || 0);
            await storage.updateGame(gameId, {
              winnerId: game.player2Id,
              state: 'finished',
              pot: totalPot
            });
            
            await storage.updateUserStats(game.player2Id!, true, totalPot);
            await storage.updateUserStats(userId, false, -playerBet);
            
            await storage.createChatMessage({
              gameId,
              userId: null,
              message: 'Player 1 ran out of cards and has no bet to continue with. Player 2 wins!',
              isSystemMessage: true,
            });
            
            return res.status(400).json({ message: "You lose - no cards left and no bet to continue!" });
          }
          
          // Create a random card from bet (simulate drawing from bet pile)
          const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
          const values: ('A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K')[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
          const newCard: Card = {
            suit: suits[Math.floor(Math.random() * suits.length)],
            value: values[Math.floor(Math.random() * values.length)],
            faceUp: true
          };
          
          const player1Hand: Card[] = Array.isArray(game.player1Hand) 
            ? game.player1Hand 
            : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
          player1Hand.push(newCard);
          
          updates.player1Hand = player1Hand;
          
          // Add system message about drawing from bet
          await storage.createChatMessage({
            gameId,
            userId: null,
            message: 'Player 1 drew from their bet pile (personal stack empty)!',
            isSystemMessage: true,
          });
          
          // Check for bust
          if (calculateHandValue(player1Hand) > 21) {
            updates.player1Busted = true;
          }
          
          const updatedGame = await storage.updateGame(gameId, updates);
          return res.json(updatedGame);
        }
        
        const newCard = player1Cards.pop()!;
        newCard.faceUp = true;
        
        const player1Hand: Card[] = Array.isArray(game.player1Hand) 
          ? game.player1Hand 
          : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
        player1Hand.push(newCard);
        
        updates.player1Cards = player1Cards;
        updates.player1Hand = player1Hand;
        
        // Check for bust and notify only the player who busted
        if (calculateHandValue(player1Hand) > 21) {
          updates.player1Busted = true;
          // Only inform the busted player privately
          const updatedGame = await storage.updateGame(gameId, updates);
          return res.status(200).json({ ...updatedGame, message: "You busted! You cannot take any more actions." });
        }
      } else {
        // Draw from player 2's personal card stack
        const player2Cards: Card[] = Array.isArray(game.player2Cards) 
          ? game.player2Cards 
          : (typeof game.player2Cards === 'string' ? JSON.parse(game.player2Cards) : []);
        
        if (player2Cards.length === 0) {
          // No cards left in personal stack - check if player has bet to continue with
          const playerBet = game.player2Bet || 0;
          if (playerBet === 0) {
            // Player loses - no cards and no bet to take from
            const totalPot = (game.player1Bet || 0) + (game.player2Bet || 0);
            await storage.updateGame(gameId, {
              winnerId: game.player1Id,
              state: 'finished',
              pot: totalPot
            });
            
            await storage.updateUserStats(game.player1Id!, true, totalPot);
            await storage.updateUserStats(userId, false, -playerBet);
            
            await storage.createChatMessage({
              gameId,
              userId: null,
              message: 'Player 2 ran out of cards and has no bet to continue with. Player 1 wins!',
              isSystemMessage: true,
            });
            
            return res.status(400).json({ message: "You lose - no cards left and no bet to continue!" });
          }
          
          // Create a random card from bet (simulate drawing from bet pile)
          const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
          const values: ('A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K')[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
          const newCard: Card = {
            suit: suits[Math.floor(Math.random() * suits.length)],
            value: values[Math.floor(Math.random() * values.length)],
            faceUp: true
          };
          
          const player2Hand: Card[] = Array.isArray(game.player2Hand) 
            ? game.player2Hand 
            : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
          player2Hand.push(newCard);
          
          updates.player2Hand = player2Hand;
          
          // Add system message about drawing from bet
          await storage.createChatMessage({
            gameId,
            userId: null,
            message: 'Player 2 drew from their bet pile (personal stack empty)!',
            isSystemMessage: true,
          });
          
          // Check for bust
          if (calculateHandValue(player2Hand) > 21) {
            updates.player2Busted = true;
          }
          
          const updatedGame = await storage.updateGame(gameId, updates);
          return res.json(updatedGame);
        }
        
        const newCard = player2Cards.pop()!;
        newCard.faceUp = true;
        
        const player2Hand: Card[] = Array.isArray(game.player2Hand) 
          ? game.player2Hand 
          : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
        player2Hand.push(newCard);
        
        updates.player2Cards = player2Cards;
        updates.player2Hand = player2Hand;
        
        // Check for bust and notify only the player who busted
        if (calculateHandValue(player2Hand) > 21) {
          updates.player2Busted = true;
          // Only inform the busted player privately
          const updatedGame = await storage.updateGame(gameId, updates);
          return res.status(200).json({ ...updatedGame, message: "You busted! You cannot take any more actions." });
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
      
      // Check if player has already busted
      if ((isPlayer1 && game.player1Busted) || (isPlayer2 && game.player2Busted)) {
        return res.status(400).json({ message: "You have busted and cannot take any more actions." });
      }
      
      if (game.state !== 'hitting_staying') {
        return res.status(400).json({ message: "Game is not in hitting/staying phase" });
      }
      
      const updates: any = {};
      
      if (isPlayer1) {
        updates.player1Ready = true;
      } else {
        updates.player2Ready = true;
      }
      
      // Check if both players are ready (stayed or busted) to determine round winner
      if ((isPlayer1 && game.player2Ready) || (isPlayer2 && game.player1Ready) || (game.player1Busted && game.player2Busted)) {
        const player1Hand: Card[] = Array.isArray(game.player1Hand) 
          ? game.player1Hand 
          : (typeof game.player1Hand === 'string' ? JSON.parse(game.player1Hand) : []);
        const player2Hand: Card[] = Array.isArray(game.player2Hand) 
          ? game.player2Hand 
          : (typeof game.player2Hand === 'string' ? JSON.parse(game.player2Hand) : []);
        
        const player1Value = calculateHandValue(player1Hand);
        const player2Value = calculateHandValue(player2Hand);
        
        let roundWinnerId = null;
        
        // Determine round winner
        if (game.player1Busted && !game.player2Busted) {
          roundWinnerId = game.player2Id;
        } else if (game.player2Busted && !game.player1Busted) {
          roundWinnerId = game.player1Id;
        } else if (!game.player1Busted && !game.player2Busted) {
          if (player1Value > player2Value && player1Value <= 21) {
            roundWinnerId = game.player1Id;
          } else if (player2Value > player1Value && player2Value <= 21) {
            roundWinnerId = game.player2Id;
          }
          // Tie case - trigger tiebreaker logic
          else if (player1Value === player2Value && player1Value <= 21) {
            // Both players have same value - conduct tiebreaker
            const player1Cards: Card[] = Array.isArray(game.player1Cards) 
              ? game.player1Cards 
              : (typeof game.player1Cards === 'string' ? JSON.parse(game.player1Cards) : []);
            const player2Cards: Card[] = Array.isArray(game.player2Cards) 
              ? game.player2Cards 
              : (typeof game.player2Cards === 'string' ? JSON.parse(game.player2Cards) : []);
            
            if (player1Cards.length > 0 && player2Cards.length > 0) {
              const p1TieCard = player1Cards.pop()!;
              const p2TieCard = player2Cards.pop()!;
              
              const getCardRank = (card: Card): number => {
                if (card.value === 'A') return 14;
                if (card.value === 'K') return 13;
                if (card.value === 'Q') return 12;
                if (card.value === 'J') return 11;
                return parseInt(card.value);
              };
              
              const p1Rank = getCardRank(p1TieCard);
              const p2Rank = getCardRank(p2TieCard);
              
              if (p1Rank > p2Rank) {
                roundWinnerId = game.player1Id;
                // Winner gets both tiebreaker cards back
                player1Cards.unshift(p1TieCard, p2TieCard);
              } else if (p2Rank > p1Rank) {
                roundWinnerId = game.player2Id;
                // Winner gets both tiebreaker cards back
                player2Cards.unshift(p1TieCard, p2TieCard);
              } else {
                // Still tied, put cards back and call it a draw for this round
                player1Cards.push(p1TieCard);
                player2Cards.push(p2TieCard);
                roundWinnerId = null;
              }
              
              updates.player1Cards = JSON.stringify(player1Cards);
              updates.player2Cards = JSON.stringify(player2Cards);
              
              await storage.createChatMessage({
                gameId,
                userId: null,
                message: roundWinnerId ? `Tiebreaker! ${roundWinnerId === game.player1Id ? 'Player 1' : 'Player 2'} wins the round!` : 'Tiebreaker ended in another tie - round is a draw.',
                isSystemMessage: true,
              });
            }
          }
        } else if (game.player1Busted && game.player2Busted) {
          // Both busted - round is a draw, no winner
          roundWinnerId = null;
        }
        
        // Handle round completion
        if (roundWinnerId) {
          // Winner takes all cards from this round and the pot
          const allRoundCards = [...player1Hand, ...player2Hand];
          const roundPot = (game.pot || 0);
          
          // Add cards to winner's pile
          const winnerCards: Card[] = roundWinnerId === game.player1Id ? 
            (Array.isArray(game.player1Cards) ? game.player1Cards : JSON.parse(typeof game.player1Cards === 'string' ? game.player1Cards : '[]')) :
            (Array.isArray(game.player2Cards) ? game.player2Cards : JSON.parse(typeof game.player2Cards === 'string' ? game.player2Cards : '[]'));
          
          winnerCards.unshift(...allRoundCards); // Add to bottom of pile
          
          if (roundWinnerId === game.player1Id) {
            updates.player1Cards = JSON.stringify(winnerCards);
          } else {
            updates.player2Cards = JSON.stringify(winnerCards);
          }
          
          // Add winnings to winner's credits immediately
          await storage.updateUserStats(roundWinnerId, false, roundPot);
          
          await storage.createChatMessage({
            gameId,
            userId: null,
            message: `${roundWinnerId === game.player1Id ? 'Player 1' : 'Player 2'} wins the round and takes $${roundPot} plus all cards!`,
            isSystemMessage: true,
          });
        } else {
          // Round was a draw - pot carries over to next round
          await storage.createChatMessage({
            gameId,
            userId: null,
            message: 'Round ended in a draw. Pot carries over to next round.',
            isSystemMessage: true,
          });
        }
        
        // Check if game should end (one player out of cards)
        const player1Cards: Card[] = Array.isArray(updates.player1Cards || game.player1Cards) 
          ? (updates.player1Cards || game.player1Cards)
          : JSON.parse((updates.player1Cards || game.player1Cards) || '[]');
        const player2Cards: Card[] = Array.isArray(updates.player2Cards || game.player2Cards) 
          ? (updates.player2Cards || game.player2Cards)
          : JSON.parse((updates.player2Cards || game.player2Cards) || '[]');
        
        if (player1Cards.length === 0 || player2Cards.length === 0) {
          // Game ends - player with cards wins
          const gameWinnerId = player1Cards.length > 0 ? game.player1Id : game.player2Id;
          updates.winnerId = gameWinnerId;
          updates.state = 'finished';
          
          await storage.updateUserStats(game.player1Id, gameWinnerId === game.player1Id, 0);
          await storage.updateUserStats(game.player2Id!, gameWinnerId === game.player2Id, 0);
          
          await storage.createChatMessage({
            gameId,
            userId: null,
            message: `Game Over! ${gameWinnerId === game.player1Id ? 'Player 1' : 'Player 2'} wins by having the last cards!`,
            isSystemMessage: true,
          });
        } else {
          // Start new round - reset for betting phase
          updates.state = 'betting';
          updates.pot = game.pot || 0; // Carry over pot if round was a draw
          updates.player1Hand = JSON.stringify([]);
          updates.player2Hand = JSON.stringify([]);
          updates.player1Bet = 0;
          updates.player2Bet = 0;
          updates.player1Ready = false;
          updates.player2Ready = false;
          updates.player1Busted = false;
          updates.player2Busted = false;
          
          // Deal new cards for next round
          const player1CardsForDealing = Array.isArray(updates.player1Cards || game.player1Cards) 
            ? (updates.player1Cards || game.player1Cards)
            : JSON.parse((updates.player1Cards || game.player1Cards) || '[]');
          const player2CardsForDealing = Array.isArray(updates.player2Cards || game.player2Cards) 
            ? (updates.player2Cards || game.player2Cards)
            : JSON.parse((updates.player2Cards || game.player2Cards) || '[]');
          
          if (player1CardsForDealing.length >= 2 && player2CardsForDealing.length >= 2) {
            // Deal new initial cards
            const p1Card1 = player1CardsForDealing.pop()!;
            const p1Card2 = player1CardsForDealing.pop()!;
            const p2Card1 = player2CardsForDealing.pop()!;
            const p2Card2 = player2CardsForDealing.pop()!;
            
            p1Card1.faceUp = true;
            p1Card2.faceUp = false;
            p2Card1.faceUp = true;
            p2Card2.faceUp = false;
            
            updates.player1Hand = JSON.stringify([p1Card1, p1Card2]);
            updates.player2Hand = JSON.stringify([p2Card1, p2Card2]);
            updates.player1Cards = JSON.stringify(player1CardsForDealing);
            updates.player2Cards = JSON.stringify(player2CardsForDealing);
            
            await storage.createChatMessage({
              gameId,
              userId: null,
              message: 'New round begins! Place your bets.',
              isSystemMessage: true,
            });
          }
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
      if (winnerId) {
        await storage.updateUserStats(winnerId, true, totalPot);
      }
      
      // Update loser's stats (losses, credits decreased by their bet) 
      await storage.updateUserStats(loserId, false, -leaverBet);
      
      const winner = await storage.getUser(winnerId!);
      const loser = await storage.getUser(loserId);
      
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
