import NetworkSwitcher from "./NetworkSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";

const GlobalControls = () => (
  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
    <NetworkSwitcher />
    <LanguageSwitcher />
  </div>
);

export default GlobalControls;
