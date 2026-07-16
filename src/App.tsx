import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { ClientsPage } from "./features/clients/ClientsPage";
import { OrdersPage } from "./features/orders/OrdersPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { TagsPage } from "./features/tags/TagsPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { TodayPage } from "./features/today/TodayPage";
import { useRemoteAccentColor } from "./features/color/useRemoteAccentColor";
import { ColorPage } from "./features/color/ColorPage";

export default function App() {

  useRemoteAccentColor();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="tarefas" element={<TasksPage />} />
        <Route path="etiquetas" element={<TagsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/cor" element={<ColorPage />} />
      </Route>
    </Routes>
  );
}