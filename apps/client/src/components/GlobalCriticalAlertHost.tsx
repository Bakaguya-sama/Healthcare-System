import { useHealthAlertStore } from "../store/useHealthAlertStore";
import { HealthAlertModal } from "@repo/ui/components/complex-modal/HealthAlertModal";

/**
 * Global component để hiển thị critical health alerts
 * Được mount ở App root để bắt alerts từ mọi pages
 */
export function GlobalCriticalAlertHost() {
  const { currentAlert, dismissAlert } = useHealthAlertStore();

  if (!currentAlert) {
    return null;
  }

  return (
    <HealthAlertModal
      id={currentAlert.id}
      title={currentAlert.title}
      message={currentAlert.message}
      isOpen={true}
      onClose={dismissAlert}
    />
  );
}
