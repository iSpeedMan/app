import { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Try to get from localStorage first
    const savedLang = localStorage.getItem('language');
    return savedLang || 'ru';
  });
  
  const { t } = useTranslation(language);
  
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);
  
  const changeLanguage = (lang) => {
    setLanguage(lang);
  };
  
  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
