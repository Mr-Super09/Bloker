import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

interface GameSettingsProps {
  numDecks: number;
  allowPeek: boolean;
  onSettingsChange: (settings: { numDecks: number; allowPeek: boolean }) => void;
}

export function GameSettings({ numDecks, allowPeek, onSettingsChange }: GameSettingsProps) {
  const handleNumDecksChange = (value: string) => {
    onSettingsChange({
      numDecks: parseInt(value),
      allowPeek,
    });
  };

  const handleAllowPeekChange = (checked: boolean) => {
    onSettingsChange({
      numDecks,
      allowPeek: checked,
    });
  };

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-lg p-6 card-glow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Settings className="text-primary mr-2" size={20} />
        Game Settings
      </h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="num-decks" className="text-sm font-medium mb-2 block">
            Number of Decks
          </Label>
          <Select value={numDecks.toString()} onValueChange={handleNumDecksChange}>
            <SelectTrigger id="num-decks" data-testid="select-num-decks">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Deck</SelectItem>
              <SelectItem value="2">2 Decks</SelectItem>
              <SelectItem value="3">3 Decks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="allow-peek" className="text-sm font-medium">
            Allow Face-down Peek
          </Label>
          <Switch
            id="allow-peek"
            checked={allowPeek}
            onCheckedChange={handleAllowPeekChange}
            data-testid="switch-allow-peek"
          />
        </div>
      </div>
    </div>
  );
}
