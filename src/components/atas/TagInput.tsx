import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useTagsStore } from "@/store/tags.store";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagInput({ tags, onTagsChange }: TagInputProps) {
  const [tagInput, setTagInput] = useState("");
  const { getOrCreateTag } = useTagsStore();

  const handleAddTag = async () => {
    const trimmedInput = tagInput.trim();
    if (!trimmedInput || tags.includes(trimmedInput)) {
      setTagInput("");
      return;
    }

    try {
      // Create tag in database if it doesn't exist
      await getOrCreateTag(trimmedInput);
      
      // Add to local tags list
      onTagsChange([...tags, trimmedInput]);
      setTagInput("");
    } catch (error) {
      console.error('Error creating tag:', error);
      // Still add to local list even if DB creation fails
      onTagsChange([...tags, trimmedInput]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter(t => t !== tag));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-destructive" 
                onClick={() => handleRemoveTag(tag)} 
              />
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex gap-2">
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Digite uma tag e pressione Enter"
        />
        <Button type="button" variant="outline" onClick={handleAddTag}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}