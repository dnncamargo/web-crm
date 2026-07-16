import { Badge } from "../../../components/ui/Badge";
import { Switch } from "../../../components/ui/Switch";
import { entityLabels, tagEntityDescriptions } from "../tagConfig";
import type { Tag, TagEntity } from "../tagTypes";

interface TagListViewProps {
  tags: Tag[];
  onRequestViewTag: (tag: Tag) => void;
  onActiveChange: (tag: Tag, active: boolean) => Promise<void>;
}

const tagEntityOrder: TagEntity[] = [
  "product",
  "client",
  "order",
  "task",
  "global",
];

type GroupedTags = Record<TagEntity, Record<string, Tag[]>>;

function createEmptyGroupedTags(): GroupedTags {
  return tagEntityOrder.reduce<GroupedTags>((groups, entity) => {
    groups[entity] = {};
    return groups;
  }, {} as GroupedTags);
}

function groupTagsByEntityAndGroup(tags: Tag[]): GroupedTags {
  const groupedTags = createEmptyGroupedTags();

  tags.forEach((tag) => {
    const groupName = tag.group || "Sem grupo";
    const currentGroup = groupedTags[tag.entity][groupName] ?? [];

    groupedTags[tag.entity][groupName] = [...currentGroup, tag];
  });

  return groupedTags;
}

function getSortedGroupEntries(entityGroups: Record<string, Tag[]>) {
  return Object.entries(entityGroups).sort(([firstGroup], [secondGroup]) =>
    firstGroup.localeCompare(secondGroup)
  );
}

export function TagListView({
  tags,
  onRequestViewTag,
  onActiveChange,
}: TagListViewProps) {
  const groupedTags = groupTagsByEntityAndGroup(tags);

  return (
    <div className="entity-list-groups">
      {tagEntityOrder.map((entity) => {
        const entityGroups = groupedTags[entity];
        const entityTags = Object.values(entityGroups).flat();

        if (entityTags.length === 0) {
          return null;
        }

        return (
          <section className="entity-list-group" key={entity}>
            <header>
              <div>
                <strong>{entityLabels[entity]}</strong>
                <p>{tagEntityDescriptions[entity]}</p>
              </div>

              <span>
                {entityTags.length}{" "}
                {entityTags.length === 1 ? "etiqueta" : "etiquetas"}
              </span>
            </header>

            <div className="entity-list-groups">
              {getSortedGroupEntries(entityGroups).map(([groupName, groupTags]) => (
                <section className="entity-list-group" key={`${entity}-${groupName}`}>
                  <header>
                    <div>
                      <strong>{groupName}</strong>
                      <p>
                        {groupTags.length}{" "}
                        {groupTags.length === 1 ? "item" : "itens"}
                      </p>
                    </div>
                  </header>

                  <div className="entity-list-view">
                    {groupTags
                      .sort((firstTag, secondTag) =>
                        firstTag.label.localeCompare(secondTag.label)
                      )
                      .map((tag) => (
                        <article
                          className={
                            tag.active
                              ? "entity-row entity-row-with-side-action"
                              : "entity-row entity-row-with-side-action muted-card"
                          }
                          key={tag.id}
                        >
                          <button
                            type="button"
                            className="entity-row-clickable"
                            onClick={() => onRequestViewTag(tag)}
                          >
                            <div className="entity-row-main">
                              <strong className="entity-title">{tag.label}</strong>

                              <span className="entity-subtitle">
                                {entityLabels[tag.entity]} ·{" "}
                                {tag.group || "Sem grupo"} · {tag.slug}
                              </span>
                            </div>

                            <div className="entity-badges">
                              <Badge>{tag.active ? "Ativa" : "Inativa"}</Badge>
                              <Badge>{entityLabels[tag.entity]}</Badge>
                              {tag.group && <Badge>{tag.group}</Badge>}
                            </div>
                          </button>

                          <aside className="entity-row-side">
                            <Switch
                              label="Ativa"
                              checked={tag.active}
                              onChange={(checked) => onActiveChange(tag, checked)}
                            />
                          </aside>
                        </article>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}