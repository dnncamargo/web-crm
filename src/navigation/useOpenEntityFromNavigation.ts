import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  clearOpenEntityNavigationState,
  getOpenEntityId,
  resolveEntityById,
  shouldProcessOpenEntityNavigation,
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
  const handledLocationKeyRef = useRef<string | null>(null);
  const openEntityId = getOpenEntityId(location.state);

  useEffect(() => {
    if (!shouldProcessOpenEntityNavigation(handledLocationKeyRef.current, location.key, openEntityId, loading)) {
      return;
    }

    handledLocationKeyRef.current = location.key;

    const entity = resolveEntityById(entities, openEntityId);

    if (entity) {
      onOpen(entity);
    }

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: clearOpenEntityNavigationState(location.state),
    });
  }, [entities, loading, location.hash, location.key, location.pathname, location.search, location.state, navigate, onOpen, openEntityId]);
}
