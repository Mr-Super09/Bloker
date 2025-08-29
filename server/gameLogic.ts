import { Card } from "@shared/schema";

export interface GameLogic {
  createDeck(): Card[];
  shuffleDeck(deck: Card[]): Card[];
  dealInitialCards(deck: Card[]): { player1Hand: Card[]; player2Hand: Card[]; remainingCards: Card[] };
  calculateHandValue(hand: Card[]): number;
  isBust(hand: Card[]): boolean;
  determineWinner(player1Hand: Card[], player2Hand: Card[], player1Busted: boolean, player2Busted: boolean): string | null;
  drawCard(deck: Card[]): { card: Card; remainingCards: Card[] };
}

export class BlokerGameLogic implements GameLogic {
  createDeck(): Card[] {
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

  shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  dealInitialCards(deck: Card[]): { player1Hand: Card[]; player2Hand: Card[]; remainingCards: Card[] } {
    const remainingCards = [...deck];
    
    // Deal 2 cards to each player alternating
    const player1Hand: Card[] = [];
    const player2Hand: Card[] = [];
    
    // First card to player 1 (face up)
    const p1Card1 = remainingCards.pop()!;
    p1Card1.faceUp = true;
    player1Hand.push(p1Card1);
    
    // First card to player 2 (face up)
    const p2Card1 = remainingCards.pop()!;
    p2Card1.faceUp = true;
    player2Hand.push(p2Card1);
    
    // Second card to player 1 (face down)
    const p1Card2 = remainingCards.pop()!;
    p1Card2.faceUp = false;
    player1Hand.push(p1Card2);
    
    // Second card to player 2 (face down)
    const p2Card2 = remainingCards.pop()!;
    p2Card2.faceUp = false;
    player2Hand.push(p2Card2);
    
    return { player1Hand, player2Hand, remainingCards };
  }

  calculateHandValue(hand: Card[]): number {
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

  isBust(hand: Card[]): boolean {
    return this.calculateHandValue(hand) > 21;
  }

  determineWinner(player1Hand: Card[], player2Hand: Card[], player1Busted: boolean, player2Busted: boolean): string | null {
    // If both busted, it's a tie (null)
    if (player1Busted && player2Busted) {
      return null;
    }
    
    // If only one busted, the other wins
    if (player1Busted && !player2Busted) {
      return 'player2';
    }
    if (player2Busted && !player1Busted) {
      return 'player1';
    }
    
    // Neither busted, compare hand values
    const player1Value = this.calculateHandValue(player1Hand);
    const player2Value = this.calculateHandValue(player2Hand);
    
    if (player1Value > player2Value) {
      return 'player1';
    } else if (player2Value > player1Value) {
      return 'player2';
    }
    
    // Tie - would trigger tiebreaker in real game
    return null;
  }

  drawCard(deck: Card[]): { card: Card; remainingCards: Card[] } {
    const remainingCards = [...deck];
    const card = remainingCards.pop()!;
    card.faceUp = true; // Drawn cards are always face up
    
    return { card, remainingCards };
  }

  // Tiebreaker logic for Bloker
  conductTiebreaker(player1Hand: Card[], player2Hand: Card[], remainingCards: Card[]): {
    winner: string | null;
    player1Hand: Card[];
    player2Hand: Card[];
    remainingCards: Card[];
  } {
    let updatedPlayer1Hand = [...player1Hand];
    let updatedPlayer2Hand = [...player2Hand];
    let updatedRemainingCards = [...remainingCards];
    
    // Each player draws one face-down card
    const p1TiebreakerCard = updatedRemainingCards.pop()!;
    p1TiebreakerCard.faceUp = true;
    updatedPlayer1Hand.push(p1TiebreakerCard);
    
    const p2TiebreakerCard = updatedRemainingCards.pop()!;
    p2TiebreakerCard.faceUp = true;
    updatedPlayer2Hand.push(p2TiebreakerCard);
    
    // Compare tiebreaker card values (Ace = 14, King = 13, etc., 2 = 2)
    const getCardRank = (card: Card): number => {
      if (card.value === 'A') return 14;
      if (card.value === 'K') return 13;
      if (card.value === 'Q') return 12;
      if (card.value === 'J') return 11;
      return parseInt(card.value);
    };
    
    const p1TiebreakerValue = getCardRank(p1TiebreakerCard);
    const p2TiebreakerValue = getCardRank(p2TiebreakerCard);
    
    let winner: string | null = null;
    if (p1TiebreakerValue > p2TiebreakerValue) {
      winner = 'player1';
    } else if (p2TiebreakerValue > p1TiebreakerValue) {
      winner = 'player2';
    }
    // If still tied, winner remains null (could extend to multiple tiebreaker rounds)
    
    return {
      winner,
      player1Hand: updatedPlayer1Hand,
      player2Hand: updatedPlayer2Hand,
      remainingCards: updatedRemainingCards,
    };
  }

  // Create multiple decks for Bloker
  createMultipleDecks(numDecks: number): Card[] {
    let allCards: Card[] = [];
    for (let i = 0; i < numDecks; i++) {
      allCards = allCards.concat(this.createDeck());
    }
    return this.shuffleDeck(allCards);
  }

  // Reveal face-down cards (after betting phase)
  revealFaceDownCards(hand: Card[]): Card[] {
    return hand.map(card => ({ ...card, faceUp: true }));
  }

  // Check if a hand has a Bloker (21 exactly)
  isBlackjack(hand: Card[]): boolean {
    return hand.length === 2 && this.calculateHandValue(hand) === 21;
  }

  // Get visible hand value (only counting face-up cards)
  getVisibleHandValue(hand: Card[]): number {
    const visibleCards = hand.filter(card => card.faceUp);
    return this.calculateHandValue(visibleCards);
  }
}

export const gameLogic = new BlokerGameLogic();
