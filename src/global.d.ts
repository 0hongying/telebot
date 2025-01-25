declare type int = number;
declare type str = string;
declare type Rec<T> = Record<str, T>;
declare type obj = Rec<any>;

declare type ID = int;
declare type id = str;

declare interface QueryAdmin {
  page: int;
  pageSize: int;
  where?: Rec<any>;
}
declare interface API_RES<T> {
  code: int;
  msg: str;
  data: T | null;
}
declare type QueryType = {
  skip: int;
  take: int;
  where: Rec<any>;
};

declare interface ListRecords<T = any> {
  list: T[];
  total: int;
  msg?: str;
}

declare type PartialData<T = any> = T;

declare type SOURCE = 'nsfwcharacterai';

declare type ChannelType =
  | 'EVONET'
  | 'PADDLE'
  | 'GUMROAD'
  | 'CHARGEBEE'
  | 'RIOTMODELS'
  | 'AIRWALLEX';
declare interface PayloadType {
  payloadType: 'characters' | 'user_profiles' | 'reviews';
  userId?: string;
}

declare interface ModerationResp {
  id: string;
  model: string;
  results: [
    {
      flagged: boolean;
      categories: {
        sexual: boolean;
        hate: boolean;
        harassment: boolean;
        'self-harm': boolean;
        'sexual/minors': boolean;
        'hate/threatening': boolean;
        'violence/graphic': boolean;
        'self-harm/intent': boolean;
        'self-harm/instructions': boolean;
        'harassment/threatening': boolean;
        violence: boolean;
      };
      category_scores: {
        sexual: number;
        hate: number;
        harassment: number;
        'self-harm': number;
        'sexual/minors': number;
        'hate/threatening': number;
        'violence/graphic': number;
        'self-harm/intent': number;
        'self-harm/instructions': number;
        'harassment/threatening': number;
        violence: number;
      };
    },
  ];
}