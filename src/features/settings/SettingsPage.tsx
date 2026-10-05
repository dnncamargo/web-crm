import { Link } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SETTINGS_ITEMS } from "./settingsNavigation";

export function SettingsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Configurações"
        description="Ajuste a aparência do sistema e os destinos de impressão."
      />

      <Card>
        <nav className="panel-list" aria-label="Configurações">
          {SETTINGS_ITEMS.map((item) => (
            <Link className="panel-list-row settings-list-row" key={item.to} to={item.to}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </nav>
      </Card>
    </div>
  );
}
