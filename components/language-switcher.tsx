
"use client"
import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/context/language-context';

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'ur', name: 'Urdu' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'ps', name: 'Pashto' },
  { code: 'bal', name: 'Balochi' },
  { code: 'skr', name: 'Saraiki' },
  { code: 'poth', name: 'Potohari' },
];

export default function LanguageSwitcher() {
  const { currentLanguage, setLanguage, isTranslating } = useLanguage();

  const handleLanguageChange = async (languageName: string) => {
    if (languageName === currentLanguage) return;
    await setLanguage(languageName);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isTranslating}>
          {isTranslating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Languages className="h-5 w-5" />
          )}
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => handleLanguageChange(lang.name)}
            disabled={isTranslating}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
