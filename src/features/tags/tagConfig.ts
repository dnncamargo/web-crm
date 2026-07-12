import type { TagEntity } from "./tagTypes";

export const entityLabels: Record<TagEntity, string> = {
  product: "Produto",
  client: "Cliente",
  order: "Pedido",
  task: "Tarefa",
  global: "Global",
};

export const tagEntityDescriptions: Record<TagEntity, string> = {
  product: "Categorias, rotulagem, alertas nutricionais e cuidados de produto.",
  client: "Restrições, preferências, perfil e cuidados do cliente.",
  order: "Cuidados, entrega, pagamento e marcações internas do pedido.",
  task: "Tipo, prioridade e contexto das tarefas.",
  global: "Etiquetas reutilizáveis em mais de uma área do sistema.",
};

export const tagGroupOptions: Record<TagEntity, string[]> = {
  product: ["Categoria", "Unidade de venda", "Rotulagem", "Alerta nutricional", "Cuidado"],
  client: ["Restrição", "Preferência", "Perfil", "Cuidado"],
  order: ["Cuidado", "Entrega", "Pagamento", "Status interno"],
  task: ["Tipo", "Prioridade", "Contexto"],
  global: ["Geral"],
};

export function getDefaultTagGroup(entity: TagEntity) {
  return tagGroupOptions[entity][0] ?? "Geral";
}

export function getTagGroupOptions(entity: TagEntity) {
  return tagGroupOptions[entity] ?? [];
}

export const productStructuralGroups = [
  "Categoria",
  "Unidade de venda",
] as const;

export function isProductStructuralGroup(group?: string) {
  return productStructuralGroups.includes(
    group as (typeof productStructuralGroups)[number]
  );
}