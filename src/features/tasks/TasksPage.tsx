import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function TasksPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Tarefas"
        description="Afazeres com subtarefas e transformação em pedido."
      />

      <Card>
        <div className="empty-state">
          <strong>Tarefas ainda não implementadas.</strong>
          <span>
            Esta área terá tarefas simples, subtarefas e o botão para
            transformar em pedido.
          </span>
        </div>
      </Card>
    </div>
  );
}