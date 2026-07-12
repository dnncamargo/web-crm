import { Card } from "../../../components/ui/Card";
import type { Client } from "../../clients/clientTypes";
import type { Order } from "../../orders/orderTypes";
import type { Task } from "../../tasks/taskTypes";
import { TodayContactSuggestionsPanel } from "./TodayContactSuggestionsPanel";
import { TodayOpenTasksPanel } from "./TodayOpenTasksPanel";
import { TodayPendingPaymentsPanel } from "./TodayPendingPaymentsPanel";

interface TodayOtherInformsProps {
  pendingPayments: Order[];
  contactSuggestions: Client[];
  openTasks: Task[];
}

export function TodayOtherInforms({ pendingPayments, contactSuggestions, openTasks }: TodayOtherInformsProps) {
  return (
    <section className="today-section">
      <div className="today-section-header">
        <div>
          <h2>Outras informações pendentes</h2>
        </div>
      </div>

      <section className="today-columns">
        <Card>
          <TodayPendingPaymentsPanel pendingPayments={pendingPayments} />
        </Card>

        <Card>
          <TodayContactSuggestionsPanel contactSuggestions={contactSuggestions} />
        </Card>

        <Card>
          <TodayOpenTasksPanel openTasks={openTasks} />
        </Card>
      </section>
    </section>
  );
}
