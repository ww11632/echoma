import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Simplified global controls for MVP mode
 * Only includes Settings and Language/Theme switcher (no network switcher)
 */
const MvpGlobalControls = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/settings")}
        title="設置 / Settings"
      >
        <Settings className="h-5 w-5" />
      </Button>
      <LanguageSwitcher />
    </div>
  );
};

export default MvpGlobalControls;

