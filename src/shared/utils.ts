import { createHash } from 'crypto';
import { RESP_TXT } from './const';
import { OpenAIInputMessage } from 'src/chat/types/openai';

export const shuffle = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const msgSuccess = <T>({ code = 200, msg = RESP_TXT.OK, data = null }: Partial<API_RES<T>>): API_RES<T> => {
  return {
    code,
    msg,
    data,
  };
};

export const msgFail = <T>({ code = 400, msg = RESP_TXT.ERR, data = null }: Partial<API_RES<T>>): API_RES<T> => {
  return {
    code,
    msg,
    data,
  };
};

export const getBotAvatarUrl = (bucketUrl: string, avatar?: string) => (avatar ? `${bucketUrl}/bot-avatars/${avatar}` : '');

export const formatDateToYYMMDDHHmm = (now: Date) => {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export const formatDateToYYMMDD = (now: Date) => {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTokenLength = (messages: OpenAIInputMessage[]) => {
  return JSON.stringify(messages).length / 3.8;
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fomatMessage = (message: string, name: string, userName?: string) => {
  message = message
    .replace(/{{char}}/gi, name)
    .replace(/{{user}}/gi, userName || 'Me')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/["“](.*?)["”]/g, '*$1*');
  return message;
};

export const formatVaildHtml = (description: string) => {
  const allowedTags = new Set(['b', 'i', 'u', 'a', 's', 'code', 'pre', 'tg-spoiler']);
  return description.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => (allowedTags.has(tagName.toLowerCase()) ? match : ''));
};

export const getDateDiff = (startDate: Date, endDate: Date) => {
  if (startDate >= endDate) return 0;
  return Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
};

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export const fomatUserName = (userName?: string) => {
  return userName ? userName.slice(0, 2) + '***' : '';
};

export const generateRandomString = (length: number) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
};
