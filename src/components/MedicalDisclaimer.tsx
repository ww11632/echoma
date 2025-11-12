import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

const DISCLAIMER_STORAGE_KEY = "echoma_disclaimer_acknowledged";

export const MedicalDisclaimer = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    // 檢查是否已經確認過免責聲明
    const hasAcknowledged = localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "true";
    if (!hasAcknowledged) {
      setOpen(true);
    }
  }, []);

  const handleContinue = () => {
    if (acknowledged) {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>{t("disclaimer.title")}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-4 text-base leading-relaxed">
            {t("disclaimer.message")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
          />
          <label
            htmlFor="acknowledge"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {t("disclaimer.acknowledge")}
          </label>
        </div>
        <AlertDialogFooter>
          <Button
            onClick={handleContinue}
            disabled={!acknowledged}
            className="w-full"
          >
            {t("disclaimer.continue")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

