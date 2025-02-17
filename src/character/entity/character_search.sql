 SELECT characters.created_at,
    characters.updated_at,
    characters.avatar,
    characters.name,
    characters.description,
    characters.first_message,
    characters.personality,
    characters.scenario,
    characters.example_dialogs,
    characters.is_public,
    characters.creator_id,
    characters.introduction,
    characters.gender_id,
    ARRAY( SELECT tags.id
           FROM character_tags
             JOIN tags ON character_tags.tag_id = tags.id
          WHERE character_tags.character_id = characters.id AND tags.obsolete = false) AS tag_ids,
    COALESCE(character_stats.total_chat, 0::bigint) AS total_chat,
    COALESCE(character_stats.total_message, 0::bigint) AS total_message,
   FROM characters
     LEFT JOIN character_stats ON characters.id = character_stats.character_id