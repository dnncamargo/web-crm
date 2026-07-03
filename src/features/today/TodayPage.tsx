import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function TodayPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Hoje"
        description="Resumo rápido de entregas, pagamentos, tarefas e sugestões inteligentes."
      />

      <div className="summary-grid">
        <Card>
          <div className="summary-card">
            <span>Entregas hoje</span>
            <strong>0</strong>
          </div>
        </Card>

        <Card>
          <div className="summary-card">
            <span>Pagamentos pendentes</span>
            <strong>R$ 0,00</strong>
          </div>
        </Card>

        <Card>
          <div className="summary-card">
            <span>Tarefas abertas</span>
            <strong>0</strong>
          </div>
        </Card>

        <Card>
          <div className="summary-card">
            <span>Sugestões</span>
            <strong>0</strong>
          </div>
        </Card>
      </div>

      <Card>
        <div className="section-header">
          <div>
            <h2>Sugestões inteligentes</h2>
            <p>O sistema exibirá aqui ações calculadas automaticamente.</p>
          </div>
        </div>

        <div className="suggestion-list">
          <div className="suggestion-item">
            <div>
              <strong>Clientes favoritos com dados faltantes</strong>
              <span>
                Quando houver favoritos sem endereço, aniversário ou contato
                principal, eles aparecerão aqui.
              </span>
            </div>

            <Badge>planejado</Badge>
          </div>

          <div className="suggestion-item">
            <div>
              <strong>Pagamentos pendentes</strong>
              <span>
                Pedidos a pagar ou parcialmente pagos serão destacados nesta
                seção.
              </span>
            </div>

            <Badge>planejado</Badge>
          </div>

          <div className="suggestion-item">
            <div>
              <strong>Frequência de relacionamento vencida</strong>
              <span>
                Clientes sem interação dentro da frequência definida serão
                sugeridos para contato.
              </span>
            </div>

            <Badge>planejado</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}