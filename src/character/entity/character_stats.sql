SELECT ch.id AS character_id,
    count(cts.id) AS total_chat,
    sum(cts.chat_count) AS total_message
   FROM (characters ch
     JOIN chats cts ON ((ch.id = cts.character_id)))
  WHERE ((ch.is_public = true) AND (cts.chat_count > 0))
  GROUP BY ch.id