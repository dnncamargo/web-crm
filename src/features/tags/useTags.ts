import { useEffect, useMemo, useState } from "react";

import type { NewTagData, Tag, TagEntity, UpdateTagData } from "./tagTypes";
import { createTag, listenTags, toggleTagActive, updateTag } from "./tagsService";

export function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);
  const [tagsError, setTagsError] = useState("");

  useEffect(() => {
    const unsubscribe = listenTags(
      (loadedTags) => {
        setTags(loadedTags);
        setLoadingTags(false);
      },
      (firebaseError) => {
        setTagsError(firebaseError.message);
        setLoadingTags(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredTags = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tags.filter((tag) => {
      if (showOnlyActive && !tag.active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        tag.label,
        tag.slug,
        tag.entity,
        tag.group,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [tags, search, showOnlyActive]);

  const activeTags = useMemo(
    () => tags.filter((tag) => tag.active),
    [tags]
  );

  function getTagsByEntityAndGroup(entity: TagEntity, group: string) {
    return activeTags.filter(
      (tag) => tag.entity === entity && tag.group === group
    );
  }

  async function addTag(data: Omit<NewTagData, "slug"> & { slug?: string }) {
    const slug = data.slug?.trim() || createSlug(data.label);

    await createTag({
      ...data,
      slug,
    });
  }

  async function editTag(tagId: string, data: UpdateTagData) {
    const nextData = {
      ...data,
      ...(data.label && !data.slug ? { slug: createSlug(data.label) } : {}),
    };

    await updateTag(tagId, nextData);
  }

  async function setTagActive(tag: Tag, active: boolean) {
    await toggleTagActive(tag.id, active);
  }

  return {
    tags,
    activeTags,
    filteredTags,
    search,
    setSearch,
    showOnlyActive,
    setShowOnlyActive,
    loadingTags,
    tagsError,
    getTagsByEntityAndGroup,
    addTag,
    editTag,
    setTagActive,
  };
}