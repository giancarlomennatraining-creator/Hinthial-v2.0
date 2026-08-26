import { AppShell } from "@/components/layout/AppShell";
import { PlaceholderSection } from "@/components/ui/PlaceholderSection";

export default function SettingsPage() {
  return (
    <AppShell>
      <PlaceholderSection
        title="Impostazioni"
        description="Qui gestirai profilo, sicurezza, recovery key ed export dei dati. Questa sezione verrà ampliata nelle prossime fasi."
      />
    </AppShell>
  );
}
