import {
  users,
  games,
  challenges,
  chatMessages,
  type User,
  type UpsertUser,
  type Game,
  type Challenge,
  type ChatMessage,
  type InsertGame,
  type InsertChallenge,
  type InsertChatMessage,
  type Card,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getOnlineUsers(excludeUserId?: string): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  updateUserStats(userId: string, won: boolean, winnings: number): Promise<void>;

  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  getGameWithPlayers(id: string): Promise<any>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game>;
  getUserActiveGame(userId: string): Promise<Game | undefined>;
  deleteGame(id: string): Promise<void>;

  // Challenge operations
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  getChallenge(id: string): Promise<Challenge | undefined>;
  getChallengesForUser(userId: string): Promise<any[]>;
  updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge>;
  deleteChallenge(id: string): Promise<void>;

  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(gameId: string, limit?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getOnlineUsers(excludeUserId?: string): Promise<User[]> {
    const query = db.select().from(users).where(eq(users.isOnline, true));
    if (excludeUserId) {
      query.where(and(eq(users.isOnline, true), eq(users.id, excludeUserId)));
    }
    return await query.orderBy(asc(users.lastActive));
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ 
        isOnline, 
        lastActive: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserStats(userId: string, won: boolean, winnings: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    await db
      .update(users)
      .set({
        wins: won ? user.wins + 1 : user.wins,
        losses: won ? user.losses : user.losses + 1,
        totalWinnings: user.totalWinnings + winnings,
        credits: user.credits + winnings,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Game operations
  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async getGame(id: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async getGameWithPlayers(id: string): Promise<any> {
    const [game] = await db
      .select({
        game: games,
        player1: users,
        player2: users,
      })
      .from(games)
      .leftJoin(users, eq(games.player1Id, users.id))
      .leftJoin(users, eq(games.player2Id, users.id))
      .where(eq(games.id, id));
    
    return game ? {
      ...game.game,
      player1: game.player1,
      player2: game.player2,
    } : undefined;
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    const [updatedGame] = await db
      .update(games)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    return updatedGame;
  }

  async getUserActiveGame(userId: string): Promise<Game | undefined> {
    const [game] = await db
      .select()
      .from(games)
      .where(
        and(
          or(eq(games.player1Id, userId), eq(games.player2Id, userId)),
          eq(games.state, 'finished')
        )
      )
      .orderBy(desc(games.updatedAt));
    return game;
  }

  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  // Challenge operations
  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const [newChallenge] = await db.insert(challenges).values(challenge).returning();
    return newChallenge;
  }

  async getChallenge(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id));
    return challenge;
  }

  async getChallengesForUser(userId: string): Promise<any[]> {
    const challengesList = await db
      .select({
        challenge: challenges,
        challenger: users,
        challenged: users,
      })
      .from(challenges)
      .leftJoin(users, eq(challenges.challengerId, users.id))
      .leftJoin(users, eq(challenges.challengedId, users.id))
      .where(
        and(
          or(eq(challenges.challengerId, userId), eq(challenges.challengedId, userId)),
          eq(challenges.status, 'pending')
        )
      )
      .orderBy(desc(challenges.createdAt));

    return challengesList.map(row => ({
      ...row.challenge,
      challenger: row.challenger,
      challenged: row.challenged,
    }));
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge> {
    const [updatedChallenge] = await db
      .update(challenges)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(challenges.id, id))
      .returning();
    return updatedChallenge;
  }

  async deleteChallenge(id: string): Promise<void> {
    await db.delete(challenges).where(eq(challenges.id, id));
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async getChatMessages(gameId: string, limit: number = 50): Promise<any[]> {
    const messages = await db
      .select({
        message: chatMessages,
        user: users,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(chatMessages.gameId, gameId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);

    return messages.map(row => ({
      ...row.message,
      user: row.user,
    }));
  }
}

export const storage = new DatabaseStorage();
