import { Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PasswordStrengthIndicator({ password }) {
  const { t } = useLanguage();
  
  const requirements = [
    {
      label: t('minChars'),
      test: (pwd) => pwd.length >= 8,
      id: 'length'
    },
    {
      label: t('uppercase'),
      test: (pwd) => /[A-Z]/.test(pwd),
      id: 'uppercase'
    },
    {
      label: t('lowercase'),
      test: (pwd) => /[a-z]/.test(pwd),
      id: 'lowercase'
    },
    {
      label: t('specialChar'),
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd),
      id: 'special'
    }
  ];

  const getStrength = () => {
    const passed = requirements.filter(req => req.test(password)).length;
    if (passed === 0) return { label: 'Very Weak', color: 'bg-red-500', width: '0%' };
    if (passed === 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
    if (passed === 2) return { label: 'Fair', color: 'bg-orange-500', width: '50%' };
    if (passed === 3) return { label: 'Good', color: 'bg-yellow-500', width: '75%' };
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  const strength = getStrength();
  const allPassed = requirements.every(req => req.test(password));

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar */}
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Password Strength:</span>
            <span className={`font-medium ${
              strength.label === 'Strong' ? 'text-green-600 dark:text-green-400' :
              strength.label === 'Good' ? 'text-yellow-600 dark:text-yellow-400' :
              strength.label === 'Fair' ? 'text-orange-600 dark:text-orange-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {strength.label}
            </span>
          </div>
          <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full ${strength.color} transition-all duration-300`}
              style={{ width: strength.width }}
            />
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <div className="space-y-2">
        {requirements.map((req) => {
          const passed = req.test(password);
          const attempted = password.length > 0;
          
          return (
            <div
              key={req.id}
              className={`flex items-start gap-2 text-xs transition-colors ${
                !attempted ? 'text-muted-foreground' :
                passed ? 'text-green-600 dark:text-green-400' : 
                'text-red-600 dark:text-red-400'
              }`}
              data-testid={`password-requirement-${req.id}`}
            >
              <div className="mt-0.5">
                {!attempted ? (
                  <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center" />
                ) : passed ? (
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
