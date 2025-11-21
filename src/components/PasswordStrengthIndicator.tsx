import { useTranslation } from "react-i18next";
import { checkPasswordStrength } from "@/lib/userPassword";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const { t } = useTranslation();

  if (!password) return null;

  const { isValid, errors } = checkPasswordStrength(password);

  // Calculate strength level
  let strength: "weak" | "medium" | "strong" = "weak";
  let strengthColor = "bg-red-500";
  let strengthText = t("password.strength.weak", "弱");

  if (isValid) {
    strength = "strong";
    strengthColor = "bg-green-500";
    strengthText = t("password.strength.strong", "強");
  } else if (errors.length <= 1) {
    strength = "medium";
    strengthColor = "bg-yellow-500";
    strengthText = t("password.strength.medium", "中等");
  }

  // Calculate progress percentage
  const maxErrors = 3; // Total number of possible errors
  const progress = ((maxErrors - errors.length) / maxErrors) * 100;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${strengthColor} transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-medium min-w-[40px]">{strengthText}</span>
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {errors.map((error, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{error}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Success message */}
      {isValid && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <span>✓</span>
          <span>{t("password.strength.good", "密碼強度良好")}</span>
        </p>
      )}
    </div>
  );
};

