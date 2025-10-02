import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useTagsStore } from "@/store/tags.store";
import { Tag } from "@/repositories/tagsRepo.supabase";
import { logger } from '../../lib/logging';


interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagInput({ tags, onTagsChange }: TagInputProps) {
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getOrCreateTag, searchTags } = useTagsStore();

  // Debounced search for suggestions
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (tagInput.trim() && tagInput.length > 1) {
        try {
          const results = await searchTags(tagInput.trim());
          // Filter out already selected tags
          const filteredResults = results.filter(tag => !tags.includes(tag.name));
          setSuggestions(filteredResults);
          setShowSuggestions(filteredResults.length > 0);
          setSelectedIndex(-1);
        } catch (error) {
          logger.error('Error searching tags:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [tagInput, tags, searchTags]);

  const handleAddTag = async (tagName?: string) => {
    const nameToAdd = tagName || tagInput.trim();
    if (!nameToAdd || tags.includes(nameToAdd)) {
      setTagInput("");
      setShowSuggestions(false);
      return;
    }

    try {
      logger.debug('TagInput: Creating tag with name:', nameToAdd);
      // Create tag in database if it doesn't exist
      const createdTag = await getOrCreateTag(nameToAdd);
      logger.debug('TagInput: Tag created/retrieved:', createdTag);
      
      // Add to local tags list
      onTagsChange([...tags, nameToAdd]);
      setTagInput("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } catch (error) {
      logger.error('TagInput: Error creating tag:', error);
      // Still add to local list even if DB creation fails
      onTagsChange([...tags, nameToAdd]);
      setTagInput("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (suggestion: Tag) => {
    handleAddTag(suggestion.name);
  };

  const handleButtonClick = () => {
    handleAddTag();
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter(t => t !== tag));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleAddTag(suggestions[selectedIndex].name);
        } else {
          handleAddTag();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Enter' || e.key === ',') {
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
      
      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow click events
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            placeholder="Digite uma tag e pressione Enter"
          />
          <Button type="button" variant="outline" onClick={handleButtonClick}>
            Adicionar
          </Button>
        </div>
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                  index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium">{suggestion.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}