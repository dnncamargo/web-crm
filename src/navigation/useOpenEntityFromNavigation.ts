import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  clearOpenEntityNavigationState,
  getOpenEntityId,
  resolveEntityById,
} from "./entityNavigation";

interface UseOpenEntityFromNavigationOptions<T extends { id: string }> {
  entities: T[];
  loading: boolean;
  onOpen: (entity: T) => void;
}

export function useOpenEntityFromNavigation<T extends { id: string }>({
  entities,
  loading,
  onOpen,
}: UseOpenEntityFromNavigationOptions<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const openEntityId = getOpenEntityId(location.state);

  useEffect(() => {
    if (!openEntityId || loading) {
      return;
    }

    const entity = resolveEntityById(entities, openEntityId);

    if (entity) {
      onOpen(entity);
    }

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: clearOpenEntityNavigationState(location.state),
    });
  }, [entities, loading, location.hash, location.pathname, location.search, location.state, navigate, onOpen, openEntityId]);
}
