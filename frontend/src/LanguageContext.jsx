import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from './translations';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'kn', name: 'ಕನ್ನಡ', short: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'hi', name: 'हिंदी', short: 'हिंदी', flag: '🇮🇳' },
  { code: 'en', name: 'English', short: 'ENG', flag: '🌐' },
];

export function LanguageProvider({ children }) {
  // Requirement: Default language MUST be Kannada ('kn')
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('grapeguard_language');
      if (saved && (saved === 'kn' || saved === 'hi' || saved === 'en')) {
        return saved;
      }
    } catch (e) {
      // ignore local storage error
    }
    return 'kn';
  });

  const setLanguage = (langCode) => {
    if (TRANSLATIONS[langCode]) {
      setLanguageState(langCode);
      try {
        localStorage.setItem('grapeguard_language', langCode);
      } catch (e) {
        // ignore local storage error
      }
    }
  };

  // Translation helper t('nav.detect')
  const t = (path, defaultText = '') => {
    const keys = path.split('.');
    let current = TRANSLATIONS[language] || TRANSLATIONS.kn;

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback to Kannada (default) or English or key itself
        let fallback = TRANSLATIONS.kn;
        for (const k of keys) {
          if (fallback && fallback[k] !== undefined) {
            fallback = fallback[k];
          } else {
            fallback = null;
            break;
          }
        }
        if (fallback) return fallback;

        let enFallback = TRANSLATIONS.en;
        for (const k of keys) {
          if (enFallback && enFallback[k] !== undefined) {
            enFallback = enFallback[k];
          } else {
            enFallback = null;
            break;
          }
        }
        return enFallback || defaultText || keys[keys.length - 1];
      }
    }
    return current;
  };

  // Helper to get translated option
  const tOption = (category, key) => {
    return TRANSLATIONS[language]?.options?.[category]?.[key] ||
      TRANSLATIONS.kn?.options?.[category]?.[key] ||
      TRANSLATIONS.en?.options?.[category]?.[key] ||
      key;
  };

  // Helper to get translated disease info
  const getDiseaseInfo = (classKey) => {
    const key = classKey || 'healthy';
    const langObj = TRANSLATIONS[language]?.diseases?.[key] ||
      TRANSLATIONS.kn?.diseases?.[key] ||
      TRANSLATIONS.en?.diseases?.[key] ||
      TRANSLATIONS.en?.diseases?.healthy;
    return langObj;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tOption, getDiseaseInfo, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageSelector({ compact = false }) {
  const { language, setLanguage, languages } = useLanguage();

  return (
    <div className={`language-selector-wrapper ${compact ? 'compact' : ''}`}>
      <div className="lang-label-row">
        <span>🌐</span>
        <span>ಭಾಷೆ / LANGUAGE</span>
      </div>
      <div className="lang-segmented-bar">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            className={`lang-seg-btn ${language === lang.code ? 'active' : ''}`}
            onClick={() => setLanguage(lang.code)}
            title={lang.name}
          >
            <span>{lang.flag}</span>
            <span>{lang.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
