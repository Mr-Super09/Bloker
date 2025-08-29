import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  totalWinnings: integer("total_winnings").default(0),
  credits: integer("credits").default(2500),
  isOnline: boolean("is_online").default(false),
  lastActive: timestamp("last_active").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameStateEnum = pgEnum('game_state', [
  'waiting_for_players',
  'setting_up',
  'betting',
  'cards_dealt',
  'hitting_staying',
  'tiebreaker',
  'finished'
]);

export const challengeStatusEnum = pgEnum('challenge_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired'
]);

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id").notNull().references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  state: gameStateEnum("state").default('waiting_for_players'),
  currentPlayerId: varchar("current_player_id").references(() => users.id),
  pot: integer("pot").default(0),
  numDecks: integer("num_decks").default(1),
  allowPeek: boolean("allow_peek").default(true),
  player1SettingsVote: jsonb("player1_settings_vote").default('{}'),
  player2SettingsVote: jsonb("player2_settings_vote").default('{}'),
  settingsVotingDeadline: timestamp("settings_voting_deadline"),
  player1Cards: jsonb("player1_cards").default('[]'),
  player2Cards: jsonb("player2_cards").default('[]'),
  player1Hand: jsonb("player1_hand").default('[]'),
  player2Hand: jsonb("player2_hand").default('[]'),
  player1Bet: integer("player1_bet").default(0),
  player2Bet: integer("player2_bet").default(0),
  player1Ready: boolean("player1_ready").default(false),
  player2Ready: boolean("player2_ready").default(false),
  player1Busted: boolean("player1_busted").default(false),
  player2Busted: boolean("player2_busted").default(false),
  remainingCards: jsonb("remaining_cards").default('[]'),
  winnerId: varchar("winner_id").references(() => users.id),
  gameData: jsonb("game_data").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id").notNull().references(() => users.id),
  challengedId: varchar("challenged_id").notNull().references(() => users.id),
  status: challengeStatusEnum("status").default('pending'),
  message: text("message"),
  gameId: varchar("game_id").references(() => games.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id),
  userId: varchar("user_id").references(() => users.id),
  message: text("message").notNull(),
  isSystemMessage: boolean("is_system_message").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  challengesSent: many(challenges, { relationName: "challenger" }),
  challengesReceived: many(challenges, { relationName: "challenged" }),
  gamesAsPlayer1: many(games, { relationName: "player1" }),
  gamesAsPlayer2: many(games, { relationName: "player2" }),
  chatMessages: many(chatMessages),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  player1: one(users, {
    fields: [games.player1Id],
    references: [users.id],
    relationName: "player1",
  }),
  player2: one(users, {
    fields: [games.player2Id],
    references: [users.id],
    relationName: "player2",
  }),
  winner: one(users, {
    fields: [games.winnerId],
    references: [users.id],
  }),
  currentPlayer: one(users, {
    fields: [games.currentPlayerId],
    references: [users.id],
  }),
  chatMessages: many(chatMessages),
  challenge: one(challenges),
}));

export const challengesRelations = relations(challenges, ({ one }) => ({
  challenger: one(users, {
    fields: [challenges.challengerId],
    references: [users.id],
    relationName: "challenger",
  }),
  challenged: one(users, {
    fields: [challenges.challengedId],
    references: [users.id],
    relationName: "challenged",
  }),
  game: one(games, {
    fields: [challenges.gameId],
    references: [games.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  game: one(games, {
    fields: [chatMessages.gameId],
    references: [games.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertGameSchema = createInsertSchema(games).pick({
  player1Id: true,
  player2Id: true,
  state: true,
  numDecks: true,
  allowPeek: true,
  settingsVotingDeadline: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).pick({
  challengerId: true,
  challengedId: true,
  message: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  gameId: true,
  userId: true,
  message: true,
  isSystemMessage: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Game types
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  faceUp: boolean;
}

export interface GameState {
  id: string;
  player1: User;
  player2?: User;
  state: string;
  currentPlayerId?: string;
  pot: number;
  numDecks: number;
  allowPeek: boolean;
  player1Cards: Card[];
  player2Cards: Card[];
  player1Hand: Card[];
  player2Hand: Card[];
  player1Bet: number;
  player2Bet: number;
  player1Ready: boolean;
  player2Ready: boolean;
  player1Busted: boolean;
  player2Busted: boolean;
  winnerId?: string;
  gameData: any;
}
