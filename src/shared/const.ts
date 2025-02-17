import { fomatUserName, formatDateToYYMMDD, formatDateToYYMMDDHHmm } from './utils';

export const DEFAULT_CACHE_TTL = 3600 * 1000; // 1 hour

export const TEN_MINUTE_TTL = 10 * 60 * 1000;

export const RESP_TXT = {
  OK: 'ok',
  ERR: 'error',
  LOGIN_OK: 'login success',
};

export const SEARCH_CACHE_KEY = 'character_search';
export const SEARCH_CACHE_KEY_NEW = 'character_search_new';

/**
 * seconds
 */
export const MINUETE = 60;

export const HOUR = MINUETE * 60;

export const DAY = HOUR * 24;

export const CHARACTER_CARD = (name?: string, description?: string, tag?: string) => `
<b>${name}</b> 

${description?.replace(/\n/g, '')}

${tag}
`;
export const CHANNEL_FIRST_MESSAGE = `
<b>What can this bot do?</b>
Welcome to the ultimate destination for uncensored roleplaying. We offer you:
  1.Fully uncensored chats
  2.Library of 20,000+ chatbots
Unleash your fantasies here...
`;
export const CHANNEL_BEGIN_MESSAGE = `
<b>Please note the following:</b>
 1.This bot is intended for users who are 18 and older.
 2.We utilize cookies to improve your experience on our bot.
`;
export const HELP_MESSAGE = `If you encounter any issues or have suggestions, please reach out to us at <a href="mailto:support@roymateai.com">support@roymateai.com</a>.`;
export const CHANNEL_BOT_ID = 1;
export const TELEGRAM_USER_DAILY_MESSAGE_COUNT = 25;
export const TELEGRAM_BOT_PER_MINUTE_MESSAGE_COUNT = 1500;
export const getWebsiteUrl = (domain: string, chatId: number, userId: number, isChannel: boolean) => {
  return `${domain}/${chatId}_${userId}_${isChannel}`;
};
export const getUserDailyMsgCountKey = (now: Date) => `user:daily:msg:count:${formatDateToYYMMDD(now)}`;
export const getTelegramBotControlKey = (now: Date) => `telegram:bot:control:${formatDateToYYMMDDHHmm(now)}`;
export const MAX_LENGTH = 1024;
export const MESSAGE_MAX_LENGTH = 4096;
export const getBotUpdateId = (botId: number, now: Date) => `bot:${botId}:update:id:set:${formatDateToYYMMDD(now)}`;

export const getFreeTrialQuotaTip = (leftQuota: number, quotaCount: number) => `
<b>Plan:</b> Free Trial
${leftQuota}/${quotaCount} messages left! Subscribe now for more credits and keep the conversation going! 
`;

export const getSubscriptionQuotaTip = (planName: string, usedCount: number, quotaCount: number, day: number) => `
<b>Plan:</b> ${planName}
<b>Monthly Messages:</b> ${usedCount}/${quotaCount}
<b>Subscription Expires in:</b> ${day} days
`;

export const getSubscriptionPageUrl = (domain: string, userId: Number) => {
  return `${domain}/pricing/${userId}`;
};

export const ssKey = '05e0c787-e9ec-46e6-a186-7b9fd908d5cc';

export const MOST_POPULAR_CHARACTER_ID = [
  'f8fd11dd-bd2f-4b5c-a453-f76c276ca9d4',
  'fbf81074-aec5-47d6-b4db-3ebfcbc65cae',
  '7b29840f-27eb-4cb0-84a1-3d79d15cb08a',
  '82067688-8d6e-4ec6-a108-57db431f6b16',
  'cfd056cd-4eaf-46aa-98ae-c86016bf46ee',
  'fe4bfced-3b7a-49aa-8c2a-5fcf1cda9f03',
  'c47329b5-08b5-42b3-87d5-625a42c0ba75',
  '6e74814c-b54c-470c-bce4-35573cee176b',
  '367cfcb7-9129-4439-9ee0-6eb055c60f72',
  '446e2787-c74e-4612-a349-7a9abe37e8d2',
  '32b2e45d-5b19-41ab-99ad-f3229f2377fb',
  'f61b14e2-20f0-4c4d-9db2-5238dacb43fc',
  'e5391a43-d526-4be2-93e0-3e8c151dd7e0',
  '63608444-2664-4689-8e6c-2e43ff560a8a',
  'f976e1a3-7782-429c-8ea2-12ea38df4943',
  'aca43e43-cc8e-4f1e-b14f-166ade87a045',
  '25d741c9-e2ca-467f-9211-bf0fe4a957b9',
  'fe9e22c3-52b7-4c71-b95f-3ab9bf96f4e1',
  '6992a5d4-5d3c-4471-8b74-df65dcf424ff',
  'fff1c1b3-4d82-4217-be66-511fbebba7ee',
  'e0b3df28-7a58-405b-a591-72ae6ae71d20',
  '2dc07006-fd26-4bd5-87a3-eb9cfda9ed91',
  '8949582c-8200-47e2-ad1f-0753e6078314',
  '9cb2ebf1-48c5-4d47-84f3-e6c4d59b5662',
  '9dab4b1b-4711-4ce2-acbd-c9028564e096',
  '86c28f63-ce7e-4d65-bde1-6d85719600b2',
  'f587dfdb-97bf-4a77-b132-db9c7eaa8ee2',
  '36f070f7-cc7f-46a9-b617-1fd9772b3192',
  '4ad7b88c-ffdc-4ff6-aa18-306eec51d245',
  'a3559d35-de56-40ab-87d7-3f15600c4457',
  '5bca4def-0ca2-46f3-9298-e0a3609eab5d',
  '4e0939f1-bca6-492d-9005-68059e79569c',
  '532c68c1-972e-4d24-b7a5-4d810f9c6b52',
  '130f8142-1b20-4f4f-80ac-9143af4995d6',
  '66e5e208-6383-4a75-893c-c465d70d44fa',
  'f61c91d5-6ca4-4173-93dd-af56a48d5c4c',
  'c7aafb65-205d-46f6-b61a-0362a333bdc9',
  '2e5c04dc-99cd-4052-827d-e7390e093855',
  'cdf31b79-7287-441a-acc5-0f6e6258dcd0',
  '819b2c7e-6054-405e-a67f-f04ebbbabb67',
  'a2618b44-ec62-495c-8318-1966db23544c',
  '99677a88-04b7-44a8-874b-2fc8dc12e9f9',
  'abd4d999-4965-4a96-998e-872213c11cff',
  '29d41b37-852d-48f0-ac2d-0ebf9e5b3a23',
  '84737b77-eac5-47e6-8515-e673732f9e67',
  'da26ce47-beeb-4a8a-9b73-f57967427321',
  '593366d4-1c8f-430b-8793-f9389db1faa9',
  '0bdc3dae-d05f-4bef-a045-e4d3d9744d35',
  'fb8f2690-88f3-43a3-9260-171ff44bf11d',
  '4bc9a851-9539-4f62-9d21-16103677736d',
  '7e91fa78-3386-43e9-9a64-8474250c6b98',
  'e3ceb08c-d5a5-43be-9a99-07e60f0ce68b',
  '3c6e646b-6655-46db-9181-6d8a88ff5203',
  'a553770a-4f8a-4248-9ae7-336173d9499c',
  'd0018857-0278-4920-b62e-3282cf6d2ad5',
  '630daaf9-4057-4caf-83a5-982055378ee4',
  '10d01c18-e407-4ca7-9df3-bef74810f47e',
  'a1c5d9ff-c33b-400e-a65e-dd2b6a7933cb',
  '3f164d27-822e-4d03-b48f-48d490d49492',
  '2af3b945-54fd-4185-8690-38be90903fb8',
  'bc160274-a434-4df2-a996-54cc6c623484',
  'bb4d8a95-f57d-4678-9a67-9f9ccdd7bf2a',
  '1977cafb-42fe-47de-ac3a-a39fa9a61731',
  '1df071dd-4c91-4e7a-a689-e5f57bc6c667',
  '39ca10c6-ea5c-4791-9e67-cfaeb549a3ed',
  'ad6b2065-f5dd-49d9-8685-3a733802b7d0',
  'e570d935-1656-450d-be00-468a6d36dd91',
  '4763bb11-87b1-48fc-aa05-4601706ccbb0',
  '0b69cb74-8577-4a8c-ae68-2bcbc34d63c6',
  '8cd4e5d2-8848-4ce2-a0ce-cc9adccdd281',
  '521570e5-bed6-489c-a95c-5b5f1b1d816b',
  'd5c15ba1-c2bc-49d9-8b6f-c167d14730db',
  'c185bb72-8cd9-4eec-85eb-341e7f6f4306',
  '26d759f9-02ff-4c0d-b023-57af0d7c2050',
  '8a706104-9d63-44b1-bb1e-f835cc9f7d07',
  'eae33cb0-e352-462f-a27a-9354547fa15d',
  '3d1cf8c1-ad25-4ea3-a945-0fd56d82485c',
  '12fe3b95-b73b-434c-88e7-a9276ddcd70a',
  'da009e73-8ad3-43ad-8846-6483a3c406c8',
  '59d6728f-a20a-4f17-a18a-4e412c92b555',
  'ce44b856-efac-4c48-bbcd-250f109c6096',
  '7a6f322d-293c-449c-be88-0b5874efa013',
  'f918ae61-82a6-40f1-b529-b919f4787e54',
  '6ef8fae0-ff0a-450b-9e80-e34948fa28c6',
  '84b5bcf5-035a-43ca-8715-c803332f414e',
  '89bd49b7-4a5c-43b0-8b99-f83026ce6505',
  '83153939-7869-4dbe-b796-850f75c8a2d7',
  '35555e28-1c3b-46b6-8bd2-a3256c0367fd',
  '614bdcd4-5030-424a-ab61-e6bdc98a85ca',
  'ea4ba396-8ace-44e3-8e6b-73fcaf04fea3',
  'a722be94-7b2f-4003-8864-3ed549a50d63',
  'cb4cb908-d14d-4d2b-bbee-04de8bd2f41c',
  'd5b02b28-132d-4f66-a5e3-e6babaf23bdb',
  'c142f939-5fdd-4221-98b3-7777324d4224',
  '51d55a8b-414c-4538-9b4f-798de681ab23',
  'cd9ea4ac-4dcd-431d-b381-53b1cd77fe54',
  'f35dd9e0-f863-4eff-a2b0-78ab435282ee',
  '40b03e82-bad5-46f7-8aa8-ff286c37d91d',
  '4a434a3b-e2e5-471c-9d68-f145dbc5f032',
  'b50416ba-3d32-4b1f-a9c8-64f7c2963e24',
];

export const FREE_QUOTA_COUNT = 35;
export const INVITE_MESSAGE = `
<b>Earn Free Message Quotas by Inviting Friends!🎉</b>

Invite 1 new user and get 20 free messages. If they subscribe, earn an extra 200 messages!😻

<b>How it Works:</b>
 1.🔗Share your invite link.
 2.👋Your friend clicks the link and starts a chat with a character.
 3.🎁Your free message rewards are automatically added!
`;

export const INVITE_MESSAGE_DETAIL = [
  'Just found a bot with over 29,000 chatbots! It’s totally uncensored and personalized. Join me and check it out!😻',
  'Want unlimited, uncensored roleplay? This bot has 29,000+ options! Join me to explore!😻',
  'Found a bot with 29,000+ chat options! Uncensored, personalized—join me for the ultimate chat experience!😻',
  'Discover the best uncensored chat bot I’ve found!😻',
  'Guys, this bot is unreal—29,000+ chatbots, fully uncensored!😻',
];

export const inviteForNewUser = (userName?: string) => `
Congrats!👏Your friend ${fomatUserName(userName)} joined, and you’ve unlocked your invitation reward!🎁
Encourage them to subscribe, and once they do, you’ll earn an extra 200 message credits!🎉
`;

export const inviteForSubscription = `
Good news!👏Your friend subscribed, and we’ve added 200 message credits to your account!🎁
Invite more friends to keep earning!🎉
`;

export const REWARD_NEW_USER_QUOTA = 10;
export const REWARD_SUBSCRIBER_QUOTA = 100;

export const getUserDailyRewardCountKey = (userId: number, now: Date) => `daily:${userId}:reward:count${formatDateToYYMMDD(now)}`;
export const REWARD_OF_DAILY_LIMIT = 100;

export const WHITE_LIST = [7206654514, 7899896020];

export const CHARACTER_INTRODUCTION_USER_PROMPT = `Let's say you're a character recommender for an AI roleplaying platform. You need to write a compelling introduction for a character, based on the character's story setting and other information, from the perspective of the target user, with the goal of getting the user very interested in the character. The requirements for a character introduction are as follows:
The introduction should maximize the sense of anticipation (e.g., create room for the user's imagination, make the user eager for a challenge, reveal some clues about the next episode, etc.);
The introduction needs to be written with reference to the information in the character's setting. In order to enhance the user's sense of anticipation and immersion, if necessary, you can also assume some settings and information without violating the original setting;
Allow the user to visualize through your introduction what kind of character they will be playing and how they can substitute into this role-play (e.g., allow the user to get an initial sense of: who the possible character is, what they can do and say, and the possible relationship between this character the user is playing and the story);
It is not necessary to state in the introduction that this is a roleplaying game;
Based on the information in the role definition, you speculate on the portrait of the user who would be best suited to play this role-play, and generate the introduction from the perspective of the user's needs;
The first sentence of the introduction should maximize the user's attention (e.g., by including elements of surprise, introducing action, introducing real emotions, directly involving the player, raising questions, revealing mysteries, etc.);
Introduce background information appropriately (e.g., setting, characterization, character relationships, direction of the main story line), but do not dramatize unnecessary details;
Introductions are output in English, using the third person;
According to the character, scene, or function setting, summarize a few keywords for the character to add in the json, the keywords are required to be attractive, and as far as possible nsfw some.
Character introduction need to return 3 different style version, and expressed in json.
{
  "versions": [
    {
      "version": "1",
      "introduction tones and strategy": "xxx",
      "character_introduction":"xxxx",
      "keywords": ["keyword1", "keyword2", "keyword3",...]
    },
    {
      "version": "2",
      "introduction tones and strategy": "xxx",
      "character_introduction":"xxxx",
      "keywords": ["keyword1", "keyword2", "keyword3",...]
    },
    {
      "version": "3",
      "introduction tones and strategy": "xxx",
      "character_introduction":"xxxx",
      "keywords": ["keyword1", "keyword2", "keyword3",...]
    }
  ]
}`;